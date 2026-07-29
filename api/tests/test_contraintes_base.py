"""Dernière ligne de défense : les contraintes portées par la BASE (C12b).

Les routes refusent déjà ces cas, via les invariants — c'est ce que couvrent les
autres fichiers de tests. Ceux-ci écrivent **directement par la session**, en
contournant les routes, pour vérifier que la base refuserait *elle aussi*. C'est
ce qui protège des écritures faites hors application : script d'import, migration,
correctif manuel en production.

Deux natures de garde-fou, et elles ne se valent pas :

- Les `CheckConstraint` sont honorées par SQLite **comme** par PostgreSQL : ces
  tests-là passent sur les deux moteurs.
- Les **types ENUM natifs** n'existent que sur PostgreSQL. SQLite range un enum
  en TEXT et accepte n'importe quelle chaîne. Le test correspondant est donc
  ignoré hors PostgreSQL, avec la raison affichée — c'est précisément le trou de
  couverture que C12b vient combler.
"""

import pytest
from sqlalchemy import Engine, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.models.equipe import Equipe, TacheEquipe


def _est_postgres(engine: Engine) -> bool:
    return engine.dialect.name == "postgresql"


# --- CheckConstraint : honorées par les deux moteurs -------------------------


def test_temps_dispo_negatif_refuse_par_la_base(session_factory: sessionmaker[Session]):
    """`ck_equipe_temps_dispo_positif` — une équipe ne peut pas avoir un temps négatif."""
    db = session_factory()
    db.add(Equipe(nom="Équipe impossible", temps_dispo_hebdo=-1))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    db.close()


def test_heures_allouees_nulles_refusees_par_la_base(
    session_factory: sessionmaker[Session], client, auth, fabrique
):
    """`ck_tache_equipe_heures_positives` — une allocation à 0 h n'a pas de sens."""
    fabrique.epic()
    projet = fabrique.projet()
    tache = fabrique.tache(projet["id"])
    equipe = fabrique.equipe()

    db = session_factory()
    db.add(TacheEquipe(tache_id=tache["id"], equipe_id=equipe["id"], heures_allouees=0))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    db.close()


def test_dependance_sur_elle_meme_refusee_par_la_base(
    session_factory: sessionmaker[Session], client, auth, fabrique
):
    """`ck_dependency_no_self` — une tâche ne peut pas dépendre d'elle-même."""
    fabrique.epic()
    projet = fabrique.projet()
    tache = fabrique.tache(projet["id"])

    db = session_factory()
    # Insertion brute : le modèle passerait par la route, qui refuse déjà.
    with pytest.raises(IntegrityError):
        db.execute(
            text(
                "INSERT INTO dependencies (tache_amont_id, tache_aval_id, type,"
                " created_at, updated_at)"
                " VALUES (:t, :t, 'FS', :now, :now)"
            ),
            {"t": tache["id"], "now": "2026-01-01 00:00:00"},
        )
        db.commit()
    db.rollback()
    db.close()


# --- Type ENUM natif : PostgreSQL uniquement --------------------------------


def test_role_hors_enum_refuse_par_la_base(engine: Engine, session_factory: sessionmaker[Session]):
    """Un rôle inexistant doit être refusé par le TYPE lui-même.

    C'est le garde-fou que SQLite ne peut pas fournir : sans PostgreSQL, cette
    ligne serait insérée sans broncher et l'application lirait un rôle inconnu.
    """
    if not _est_postgres(engine):
        pytest.skip("types ENUM natifs : PostgreSQL uniquement (cf. TEST_DATABASE_URL, C12b)")

    db = session_factory()
    with pytest.raises((DBAPIError, IntegrityError)):
        db.execute(
            text(
                "INSERT INTO users (nom, email, role, actif, created_at, updated_at)"
                " VALUES ('Pirate', 'pirate@test.local', 'superadmin', true, :now, :now)"
            ),
            {"now": "2026-01-01 00:00:00"},
        )
        db.commit()
    db.rollback()
    db.close()
