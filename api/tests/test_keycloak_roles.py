"""Lecture des rôles Keycloak et déduction du rôle applicatif.

Logique PURE (aucune E/S, aucun Keycloak) : c'est elle qui décide qui entre et
avec quels droits, elle mérite donc d'être éprouvée directement.

Le point sensible est la lecture **hybride** realm + client : elle existe pour
qu'une migration des rôles de realm vers client se fasse sans fenêtre de casse.
Les tests ci-dessous verrouillent les trois états de cette migration.
"""

import pytest

from app.auth.oidc import ROLE_ACCES, role_applicatif, roles_du_jeton
from app.models.user import UserRole

AUD = "projets9-api"


def jeton(realm: list[str] | None = None, client: list[str] | None = None) -> dict:
    p: dict = {}
    if realm is not None:
        p["realm_access"] = {"roles": realm}
    if client is not None:
        p["resource_access"] = {AUD: {"roles": client}}
    return p


# --- lecture hybride : les trois états d'une migration realm -> client -------


def test_roles_lus_depuis_le_realm_seul():
    assert roles_du_jeton(jeton(realm=[ROLE_ACCES, "admin"]), AUD) == {ROLE_ACCES, "admin"}


def test_roles_lus_depuis_le_client_seul():
    assert roles_du_jeton(jeton(client=[ROLE_ACCES, "membre"]), AUD) == {ROLE_ACCES, "membre"}


def test_roles_fusionnes_pendant_la_bascule():
    """État transitoire : une partie migrée, l'autre non. Rien ne doit se perdre."""
    p = jeton(realm=[ROLE_ACCES], client=["admin"])
    assert roles_du_jeton(p, AUD) == {ROLE_ACCES, "admin"}


def test_roles_d_un_autre_client_ignores():
    """Les rôles portés pour une AUTRE application du realm ne nous concernent pas."""
    p = {"resource_access": {"une-autre-app-api": {"roles": [ROLE_ACCES, "admin"]}}}
    assert roles_du_jeton(p, AUD) == set()


def test_jeton_sans_aucun_role():
    assert roles_du_jeton({}, AUD) == set()


def test_claims_nuls_ne_font_pas_planter():
    """Keycloak peut émettre `realm_access: {"roles": null}` — ne pas s'y casser."""
    p = {"realm_access": {"roles": None}, "resource_access": {AUD: {"roles": None}}}
    assert roles_du_jeton(p, AUD) == set()


# --- porte d'entrée et rôle applicatif ---------------------------------------


def test_sans_porte_d_entree_acces_refuse():
    """Le cas qui compte : appartenir au realm ne suffit PAS à entrer ici."""
    assert role_applicatif({"admin", "membre"}) is None


def test_porte_d_entree_seule_donne_membre():
    assert role_applicatif({ROLE_ACCES}) is UserRole.membre


def test_porte_d_entree_plus_admin_donne_admin():
    assert role_applicatif({ROLE_ACCES, "admin"}) is UserRole.admin


def test_admin_sans_porte_d_entree_reste_refuse():
    """Être admin ailleurs dans le realm n'ouvre pas cette application."""
    assert role_applicatif({"admin"}) is None


def test_role_inconnu_ne_promeut_pas():
    assert role_applicatif({ROLE_ACCES, "superviseur"}) is UserRole.membre


@pytest.mark.parametrize("roles", [set(), {"membre"}, {"app-autre-projet-access"}])
def test_refus_par_defaut(roles):
    """Par défaut on refuse : une erreur de configuration ne doit pas ouvrir l'app."""
    assert role_applicatif(roles) is None
