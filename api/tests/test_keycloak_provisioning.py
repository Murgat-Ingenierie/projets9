"""Rapprochement jeton Keycloak → compte local.

On appelle `utilisateur_depuis_jeton` directement, avec un payload déjà validé :
la vérification cryptographique (signature, `iss`, `aud`) est le travail de
`decoder_jeton_oidc` et exige un vrai Keycloak. Ce qui se teste ici, c'est la
DÉCISION : qui est rapproché, qui est créé, qui est refusé.

Enjeu concret : `projects.responsable_id` et `tasks.responsable_id` sont des FK
vers `users.id`. Un rapprochement raté créerait un doublon et orphelinerait des
affectations.
"""

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.auth.oidc import ROLE_ACCES
from app.auth.provisioning import utilisateur_depuis_jeton
from app.models.user import User, UserRole

SUB = "8f1c2e40-1111-4222-8333-444455556666"
AUD = "projets9-api"


def jeton(sub=SUB, email="pierre@lesfontaines.local", roles=(ROLE_ACCES,), nom="Pierre"):
    return {
        "sub": sub,
        "email": email,
        "name": nom,
        "resource_access": {AUD: {"roles": list(roles)}},
    }


@pytest.fixture
def db(session_factory):
    s = session_factory()
    yield s
    s.close()


def test_creation_du_compte_a_la_premiere_connexion(db):
    u = utilisateur_depuis_jeton(jeton(), db)
    assert u.id is not None
    assert u.keycloak_sub == SUB
    assert u.email == "pierre@lesfontaines.local"
    assert u.role is UserRole.membre
    assert u.actif is True


def test_deuxieme_connexion_ne_cree_pas_de_doublon(db):
    a = utilisateur_depuis_jeton(jeton(), db)
    b = utilisateur_depuis_jeton(jeton(), db)
    assert a.id == b.id
    assert db.execute(select(User).where(User.keycloak_sub == SUB)).scalars().all().__len__() == 1


def test_compte_preexistant_rapproche_par_email_et_lie_au_sub(db):
    """Le cas de la migration : le compte existe déjà (import, seed), sans `sub`."""
    ancien = User(
        nom="Pierre Ancien",
        email="pierre@lesfontaines.local",
        password_hash="x",
        role=UserRole.admin,
        actif=True,
    )
    db.add(ancien)
    db.commit()
    ancien_id = ancien.id

    u = utilisateur_depuis_jeton(jeton(roles=(ROLE_ACCES, "admin")), db)

    assert u.id == ancien_id, "doit RÉUTILISER le compte, pas en créer un second"
    assert u.keycloak_sub == SUB


def test_le_sub_prime_sur_l_email(db):
    """Si l'email change dans le realm, le lien tient par le `sub`."""
    u1 = utilisateur_depuis_jeton(jeton(), db)
    u2 = utilisateur_depuis_jeton(jeton(email="pierre.nouveau@lesfontaines.local"), db)
    assert u1.id == u2.id
    assert u2.email == "pierre.nouveau@lesfontaines.local"


def test_le_role_est_resynchronise_a_chaque_connexion(db):
    """Keycloak fait autorité : une promotion là-bas s'applique ici."""
    u = utilisateur_depuis_jeton(jeton(), db)
    assert u.role is UserRole.membre
    u = utilisateur_depuis_jeton(jeton(roles=(ROLE_ACCES, "admin")), db)
    assert u.role is UserRole.admin
    # …et une rétrogradation aussi.
    u = utilisateur_depuis_jeton(jeton(), db)
    assert u.role is UserRole.membre


def test_sans_porte_d_entree_403(db):
    with pytest.raises(HTTPException) as e:
        utilisateur_depuis_jeton(jeton(roles=("admin",)), db)
    assert e.value.status_code == 403
    assert db.execute(select(User)).scalars().all() == [], "aucun compte ne doit être créé"


def test_compte_desactive_localement_refuse(db):
    """Seul levier de révocation immédiate de l'app, indépendant du realm."""
    u = utilisateur_depuis_jeton(jeton(), db)
    u.actif = False
    db.commit()

    with pytest.raises(HTTPException) as e:
        utilisateur_depuis_jeton(jeton(), db)
    assert e.value.status_code == 403


def test_jeton_sans_sub_401(db):
    p = jeton()
    del p["sub"]
    with pytest.raises(HTTPException) as e:
        utilisateur_depuis_jeton(p, db)
    assert e.value.status_code == 401


def test_jeton_sans_email_refuse_plutot_que_d_inventer(db):
    with pytest.raises(HTTPException) as e:
        utilisateur_depuis_jeton(jeton(email=""), db)
    assert e.value.status_code == 403


def test_limite_d_utilisateurs_actifs_respectee(db, monkeypatch):
    """INV-AUTH-2 : une simple connexion ne doit pas franchir la limite en douce."""
    from app.config import settings

    monkeypatch.setattr(settings, "max_active_users", 1)
    db.add(User(nom="Déjà là", email="a@b.local", password_hash="x", role=UserRole.admin, actif=True))
    db.commit()

    with pytest.raises(HTTPException) as e:
        utilisateur_depuis_jeton(jeton(), db)
    assert e.value.status_code == 403
