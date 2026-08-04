"""Modification d'une dépendance — le type, et rien d'autre.

Comblait un manque qui obligeait à SUPPRIMER puis RECRÉER pour passer une `FS`
en `SS` : deux opérations, dont une destructive, là où il s'agit de corriger un
libellé de liaison.

Ce que ces tests verrouillent surtout, c'est la RAISON pour laquelle la route ne
rejoue aucun invariant : INV-14 (graphe acyclique) et INV-15 (pas
d'auto-dépendance) ne regardent que les extrémités. Tant que le schéma interdit
d'y toucher, aucune modification ne peut les violer. Si ce schéma s'ouvrait, les
contrôles devraient revenir — d'où le test qui vérifie que les extrémités sont
bien ignorées.
"""

import pytest


@pytest.fixture
def deux_taches(client, auth, fabrique):
    fabrique.epic()
    projet = fabrique.projet()
    return fabrique.tache(projet["id"], nom="Amont"), fabrique.tache(projet["id"], nom="Aval")


@pytest.fixture
def dependance(client, auth, deux_taches):
    amont, aval = deux_taches
    r = client.post(
        "/api/dependencies",
        json={"tache_amont_id": amont["id"], "tache_aval_id": aval["id"], "type": "FS"},
        headers=auth,
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_changer_le_type(client, auth, dependance):
    r = client.put(f"/api/dependencies/{dependance['id']}", json={"type": "SS"}, headers=auth)
    assert r.status_code == 200, r.text
    assert r.json()["type"] == "SS"
    # Les extrémités n'ont pas bougé — c'est ce qui rend l'opération sûre.
    assert r.json()["tache_amont_id"] == dependance["tache_amont_id"]
    assert r.json()["tache_aval_id"] == dependance["tache_aval_id"]


def test_les_extremites_ne_sont_pas_modifiables(client, auth, dependance, fabrique):
    """Envoyer des extrémités ne doit RIEN changer.

    C'est la garantie qui dispense la route de rejouer INV-14 et INV-15 : si ce
    test tombait, leur absence deviendrait un trou — on pourrait créer un cycle
    par une modification.
    """
    autre = fabrique.tache(1, nom="Ailleurs")
    r = client.put(
        f"/api/dependencies/{dependance['id']}",
        json={"type": "FF", "tache_amont_id": autre["id"], "tache_aval_id": autre["id"]},
        headers=auth,
    )
    assert r.status_code == 200, r.text
    assert r.json()["type"] == "FF"
    assert r.json()["tache_amont_id"] == dependance["tache_amont_id"]
    assert r.json()["tache_aval_id"] == dependance["tache_aval_id"]


def test_type_inconnu_refuse(client, auth, dependance):
    r = client.put(f"/api/dependencies/{dependance['id']}", json={"type": "XX"}, headers=auth)
    assert r.status_code == 422


def test_type_obligatoire(client, auth, dependance):
    """Un PUT vide n'a pas de sens : il n'y a qu'un champ modifiable."""
    r = client.put(f"/api/dependencies/{dependance['id']}", json={}, headers=auth)
    assert r.status_code == 422


def test_dependance_inconnue(client, auth):
    assert client.put("/api/dependencies/9999", json={"type": "SS"}, headers=auth).status_code == 404


def test_reserve_aux_administrateurs(client, auth, auth_membre, dependance):
    """Cohérent avec la création et la suppression, admin depuis le 2026-08-04."""
    r = client.put(f"/api/dependencies/{dependance['id']}", json={"type": "SS"}, headers=auth_membre)
    assert r.status_code == 403
