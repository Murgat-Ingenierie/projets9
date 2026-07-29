"""Retrait de l'authentification maison — ce qui ne doit pas revenir.

Trois chemins d'entrée ont disparu : le mode débrayé (`AUTH_DISABLED`), le login
maison (`POST /api/auth/login`) et l'admin semé au premier démarrage. Supprimer
du code ne se teste pas ; ce qui se teste, ce sont les propriétés que ce retrait
établit — et qu'une future « correction » pourrait défaire sans le vouloir.

Le cas le plus important est le premier. Le mode débrayé rendait le pire
scénario silencieux : mal configurée, l'application accordait des droits
d'ADMINISTRATEUR sans jeton. Désormais, mal configurée, elle ne démarre pas. Ce
test existe pour qu'on ne « répare » pas ce démarrage impossible en le rendant
tolérant — un opérateur pressé par un conteneur qui redémarre en boucle est
exactement celui qui serait tenté.
"""

import importlib

import pytest
from fastapi.testclient import TestClient

import app.main
from app.config import settings
from app.models.user import User


def test_l_api_refuse_de_demarrer_sans_keycloak(monkeypatch):
    """Sans realm, aucune authentification n'est possible : on ne démarre pas.

    L'alternative — démarrer et répondre 401 à tout le monde — se présente comme
    un conteneur sain. Celle-ci se voit tout de suite.
    """
    monkeypatch.setattr(settings, "keycloak_base_url", "")
    with pytest.raises(RuntimeError, match="KEYCLOAK_BASE_URL"):
        importlib.reload(app.main)


def test_le_message_de_demarrage_nomme_les_deux_variables(monkeypatch):
    """Un refus de démarrer n'aide que s'il dit quoi renseigner.

    Les deux, même quand une seule manque : l'opérateur qui lit ce message dans
    un journal de conteneur n'a pas le fichier de configuration sous les yeux.
    """
    monkeypatch.setattr(settings, "keycloak_realm", "")
    with pytest.raises(RuntimeError) as e:
        importlib.reload(app.main)
    assert "KEYCLOAK_REALM" in str(e.value)
    assert "KEYCLOAK_BASE_URL" in str(e.value)


def test_l_api_n_emet_plus_de_jeton(client: TestClient):
    """`POST /api/auth/login` a disparu : Keycloak est le seul émetteur.

    Tant qu'il existait, il restait un second chemin d'authentification, avec son
    propre secret (`JWT_SECRET`) et sa propre durée de validité — hors de portée
    de toute révocation côté realm.
    """
    r = client.post("/api/auth/login", json={"email": "a@b.local", "password": "peu importe"})
    assert r.status_code == 404


def test_aucune_route_d_authentification_ne_subsiste(client: TestClient):
    """Vérification par le CONTRAT publié, pas par la lecture d'un fichier."""
    chemins = client.get("/api/openapi.json").json()["paths"]
    assert not [c for c in chemins if c.startswith("/api/auth")], chemins.keys()


def test_creer_un_compte_ne_demande_plus_de_mot_de_passe(client: TestClient, auth):
    """Un compte local n'est plus une identité : c'est une cible de clé étrangère.

    Il sert à affecter un projet à quelqu'un qui ne s'est pas encore connecté ;
    le rapprochement avec le realm se fera par l'email.
    """
    r = client.post(
        "/api/users",
        json={"nom": "Futur arrivant", "email": "futur@lesfontaines.local", "role": "membre"},
        headers=auth,
    )
    assert r.status_code == 201, r.text


def test_le_schema_public_n_expose_aucun_champ_de_mot_de_passe(client: TestClient):
    """Ce qui n'est plus demandé ne doit pas rester dans le contrat.

    Un champ `password` encore documenté inviterait un client à en envoyer un —
    qui serait ignoré en silence, donc cru enregistré.
    """
    schemas = client.get("/api/openapi.json").json()["components"]["schemas"]
    for nom in ("UserCreate", "UserUpdate", "UserRead"):
        assert "password" not in schemas[nom]["properties"], nom


def test_la_base_ne_stocke_plus_d_empreinte_de_mot_de_passe():
    """Migration 0011 : la colonne a disparu, pas seulement son usage.

    La laisser aurait gardé en base des empreintes bcrypt qui n'ouvrent plus
    rien — et que les gens réutilisent ailleurs.
    """
    assert "password_hash" not in User.__table__.columns


def test_la_seed_laisse_la_base_sans_aucun_compte(session_factory, monkeypatch):
    """On EXÉCUTE la seed sur une base vierge et on compte : zéro.

    Elle créait auparavant un administrateur avec le mot de passe de
    `SEED_ADMIN_PASSWORD` — celui que `.env.example` invitait à changer, et que
    personne ne change. C'est maintenant Keycloak qui provisionne, à la première
    connexion.

    Conséquence assumée, vérifiée ici : une installation neuve n'a **aucun**
    compte tant que personne ne s'est connecté.
    """
    import app.seed

    monkeypatch.setattr(app.seed, "SessionLocal", session_factory)
    app.seed.main()

    db = session_factory()
    try:
        assert db.query(User).count() == 0
    finally:
        db.close()
