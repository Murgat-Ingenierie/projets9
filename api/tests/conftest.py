"""Fixtures des tests d'intégration (phase 2).

Schéma monté par `Base.metadata.create_all` — donc depuis les modèles — plutôt
que par Alembic, pour rester indépendant du moteur. Les migrations sont éprouvées
séparément (`alembic upgrade head` + `alembic check`, même job CI).

**Moteur** : SQLite en mémoire par défaut (rapide, aucun service à lancer pour
travailler en local). Si `TEST_DATABASE_URL` est défini, la suite tourne sur ce
moteur-là — c'est ainsi que la CI la rejoue sur **PostgreSQL** (chantier C12b),
ce qui met enfin à l'épreuve la dernière ligne de défense : les contraintes
`CHECK` et les types ENUM natifs, absents du chemin SQLite.

Ce que ces tests éprouvent avant tout reste l'application des invariants par les
*routes* — du Python, identique quel que soit le moteur. Le passage sur
PostgreSQL ajoute la garantie que la base elle-même refuserait ce que les routes
refusent déjà.

**Authentification injectée.** Les fixtures `auth` / `auth_membre` surchargent
`get_current_user` pour renvoyer directement un compte, sans jeton. Elles
surchargent lui SEUL : `require_admin` en dépend par `Depends` et continue donc
de s'exécuter avec sa vraie logique — un membre se voit bien refuser un endpoint
admin, les tests RBAC éprouvent la règle réelle.

Avant l'adossement à Keycloak, ces fixtures passaient par un vrai
`POST /api/auth/login`, ce qui couvrait le chemin d'authentification dans chaque
test. Ce chemin n'existe plus : il est désormais couvert explicitement par
`test_keycloak_roles.py` et `test_keycloak_provisioning.py`.
"""

from __future__ import annotations

import os
from collections.abc import Generator
from dataclasses import dataclass

import pytest
from fastapi import Depends, HTTPException, Request, status
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, event, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  (import pour peupler Base.metadata)
from app.auth.deps import get_current_user
from app.auth.security import hash_password
from app.database import Base, get_db
from app.main import app as fastapi_app
from app.models.user import User, UserRole

ADMIN_EMAIL = "admin@test.local"
ADMIN_PASSWORD = "motdepasse-admin"


def _moteur_sqlite() -> Engine:
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,  # une seule connexion : la base vit en mémoire
        future=True,
    )

    @event.listens_for(eng, "connect")
    def _active_les_fk(dbapi_conn, _record) -> None:  # type: ignore[no-untyped-def]
        # SQLite ignore les clés étrangères par défaut : sans ça, ON DELETE
        # CASCADE ne s'appliquerait pas et INV-4/INV-5 seraient testés à vide.
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    return eng


@pytest.fixture
def engine() -> Generator[Engine, None, None]:
    url = os.getenv("TEST_DATABASE_URL", "").strip()
    # Schéma monté par `create_all` dans les deux cas — donc depuis les MODÈLES,
    # y compris leurs `CheckConstraint`. (Les migrations, elles, sont éprouvées à
    # part par `alembic upgrade head` + `alembic check` dans le même job CI.)
    if url:
        eng = create_engine(url, future=True)
        # Une exécution précédente interrompue peut avoir laissé des tables :
        # on repart d'un schéma propre plutôt que d'échouer sur un `create_all`.
        Base.metadata.drop_all(eng)
    else:
        eng = _moteur_sqlite()

    Base.metadata.create_all(eng)
    try:
        yield eng
    finally:
        Base.metadata.drop_all(eng)
        eng.dispose()


@pytest.fixture
def session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@pytest.fixture
def client(session_factory: sessionmaker[Session]) -> Generator[TestClient, None, None]:
    def _get_db() -> Generator[Session, None, None]:
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    fastapi_app.dependency_overrides[get_db] = _get_db
    fastapi_app.dependency_overrides[get_current_user] = _resout_utilisateur
    with TestClient(fastapi_app) as c:
        yield c
    fastapi_app.dependency_overrides.clear()


@dataclass
class Compte:
    id: int
    email: str
    password: str


@pytest.fixture
def admin(session_factory: sessionmaker[Session]) -> Compte:
    db = session_factory()
    u = User(
        nom="Admin Test",
        email=ADMIN_EMAIL,
        password_hash=hash_password(ADMIN_PASSWORD),
        role=UserRole.admin,
        actif=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    compte = Compte(id=u.id, email=u.email, password=ADMIN_PASSWORD)
    db.close()
    return compte


#: En-tête portant l'email du compte à incarner. Résolution PAR REQUÊTE — et
#: c'est essentiel : `auth` et `auth_membre` surchargent la même dépendance, donc
#: une surcharge posée à l'installation de la fixture serait écrasée par la
#: suivante. Un test qui demande `auth_membre` ET une fixture bâtie sur `auth`
#: (comme `jeu`) se retrouverait alors à agir en ADMIN sans le savoir — un test
#: négatif passerait au vert pour la mauvaise raison.
ENTETE_COMPTE = "X-Test-User"


def _resout_utilisateur(request: Request, db: Session = Depends(get_db)) -> User:
    """Renvoie le compte désigné par l'en-tête de test.

    **En l'absence d'en-tête, on lève 401** plutôt que d'incarner un compte par
    défaut : sans quoi les tests qui vérifient qu'une requête NON authentifiée
    est refusée passeraient au vert sans rien prouver.
    """
    email = request.headers.get(ENTETE_COMPTE)
    if not email:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token manquant")
    u = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    assert u is not None, f"compte de test introuvable : {email}"
    return u


MEMBRE_EMAIL = "membre@test.local"


@pytest.fixture
def auth(admin: Compte) -> dict[str, str]:
    """Requêtes exécutées en tant qu'ADMIN."""
    return {ENTETE_COMPTE: admin.email}


@pytest.fixture
def membre(session_factory: sessionmaker[Session]) -> Compte:
    """Compte NON administrateur — de quoi vérifier ce qui doit lui être refusé."""
    db = session_factory()
    u = User(
        nom="Membre Test",
        email=MEMBRE_EMAIL,
        password_hash="!keycloak",
        role=UserRole.membre,
        actif=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    compte = Compte(id=u.id, email=u.email, password="")
    db.close()
    return compte


@pytest.fixture
def auth_membre(membre: Compte) -> dict[str, str]:
    """Requêtes exécutées en tant que MEMBRE (cf. `auth` pour le principe)."""
    return {ENTETE_COMPTE: membre.email}


# --- petites fabriques : montent le strict nécessaire pour chaque scénario ---


@pytest.fixture
def fabrique(client: TestClient, auth: dict[str, str]):
    class Fabrique:
        def epic(self, trigramme: str = "ABC", **kw):
            corps = {
                "trigramme": trigramme,
                "nom": "Epic de test",
                "statut": "idee",
                "categorie": "operationnel",
                **kw,
            }
            r = client.post("/api/epics", json=corps, headers=auth)
            assert r.status_code == 201, r.text
            return r.json()

        def projet(self, epic_trigramme: str = "ABC", **kw):
            corps = {
                "epic_trigramme": epic_trigramme,
                "nom": "Projet de test",
                "date_debut": "2026-08-01",
                "date_fin": "2026-08-31",
                **kw,
            }
            r = client.post("/api/projects", json=corps, headers=auth)
            assert r.status_code == 201, r.text
            return r.json()

        def tache(self, projet_id: int, **kw):
            corps = {
                "projet_id": projet_id,
                "nom": "Tâche de test",
                "date_debut": "2026-08-01",
                "date_fin": "2026-08-10",
                **kw,
            }
            r = client.post("/api/tasks", json=corps, headers=auth)
            assert r.status_code == 201, r.text
            return r.json()

        def equipe(self, nom: str = "Maintenance", **kw):
            corps = {"nom": nom, "temps_dispo_hebdo": 35, **kw}
            r = client.post("/api/equipes", json=corps, headers=auth)
            assert r.status_code == 201, r.text
            return r.json()

        def jalon(self, project_ids: list[int], **kw):
            corps = {
                "nom": "Jalon de test",
                "date": "2026-08-15",
                "project_ids": project_ids,
                **kw,
            }
            r = client.post("/api/milestones", json=corps, headers=auth)
            assert r.status_code == 201, r.text
            return r.json()

    return Fabrique()


def code_de(reponse) -> str | None:
    """Extrait le code INV-X d'une réponse d'erreur, ou None."""
    detail = reponse.json().get("detail")
    return detail.get("code") if isinstance(detail, dict) else None
