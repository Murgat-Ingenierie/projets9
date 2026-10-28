"""Dépendance « fin de projet → tâche » (#141).

Une tâche peut attendre l'achèvement d'un projet ENTIER. Le prédécesseur d'une
dépendance est alors `projet_amont_id` au lieu de `tache_amont_id`.

Ce que ces tests verrouillent surtout, c'est qu'INV-14 n'a pas été contourné :
la fin d'un projet attend chacune de ses tâches, donc « P précède T » ferme un
cycle dès que T appartient à P, ou qu'une de ses tâches dépend, même de loin,
de T. Le cycle peut aussi naître SANS écrire de dépendance — en rattachant une
tâche à un autre projet.
"""

import pytest

from app.invariants import InvariantError
from app.invariants.checks import check_dependency_acyclic
from tests.conftest import code_de


@pytest.fixture
def deux_projets(client, auth, fabrique):
    fabrique.epic()
    p1 = fabrique.projet(nom="Amont")
    p2 = fabrique.projet(nom="Aval")
    return p1, p2


def _lien_projet(client, auth, projet_id, tache_id, type_="FS"):
    return client.post(
        "/api/dependencies",
        json={"projet_amont_id": projet_id, "tache_aval_id": tache_id, "type": type_},
        headers=auth,
    )


def test_creer_lien_fin_de_projet(client, auth, fabrique, deux_projets):
    p1, p2 = deux_projets
    t = fabrique.tache(p2["id"])
    r = _lien_projet(client, auth, p1["id"], t["id"])
    assert r.status_code == 201, r.text
    assert r.json()["projet_amont_id"] == p1["id"]
    assert r.json()["tache_amont_id"] is None
    # Relu par la liste, que le planning consomme.
    liste = client.get("/api/dependencies", headers=auth).json()
    assert [d["projet_amont_id"] for d in liste] == [p1["id"]]


def test_projet_precedant_sa_propre_tache_refuse(client, auth, fabrique, deux_projets):
    """La tâche attendrait une fin de projet qui l'attend elle-même."""
    p1, _ = deux_projets
    t = fabrique.tache(p1["id"])
    r = _lien_projet(client, auth, p1["id"], t["id"])
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-14"


def test_cycle_indirect_par_une_tache_du_projet_refuse(client, auth, fabrique, deux_projets):
    """P1 → T2, puis T2 → T1 avec T1 dans P1 : T1 attend T2, qui attend la fin de P1."""
    p1, p2 = deux_projets
    t1 = fabrique.tache(p1["id"], nom="T1")
    t2 = fabrique.tache(p2["id"], nom="T2")
    assert _lien_projet(client, auth, p1["id"], t2["id"]).status_code == 201
    r = client.post(
        "/api/dependencies",
        json={"tache_amont_id": t2["id"], "tache_aval_id": t1["id"], "type": "FS"},
        headers=auth,
    )
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-14"


def test_rattacher_la_tache_aval_au_projet_amont_refuse(client, auth, fabrique, deux_projets):
    """Le cycle peut naître d'un changement de projet, sans nouvelle dépendance."""
    p1, p2 = deux_projets
    t = fabrique.tache(p2["id"])
    assert _lien_projet(client, auth, p1["id"], t["id"]).status_code == 201
    r = client.put(f"/api/tasks/{t['id']}", json={"projet_id": p1["id"]}, headers=auth)
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-14"
    # Refus sans effet de bord : la tâche est restée dans son projet.
    assert client.get(f"/api/tasks/{t['id']}", headers=auth).json()["projet_id"] == p2["id"]


def test_changer_de_projet_sans_cycle_accepte(client, auth, fabrique, deux_projets):
    p1, p2 = deux_projets
    p3 = fabrique.projet(nom="Tiers")
    t = fabrique.tache(p2["id"])
    assert _lien_projet(client, auth, p1["id"], t["id"]).status_code == 201
    r = client.put(f"/api/tasks/{t['id']}", json={"projet_id": p3["id"]}, headers=auth)
    assert r.status_code == 200, r.text


@pytest.mark.parametrize("type_", ["SS", "FF"])
def test_seule_la_fin_du_projet_est_attendue(client, auth, fabrique, deux_projets, type_):
    p1, p2 = deux_projets
    t = fabrique.tache(p2["id"])
    assert _lien_projet(client, auth, p1["id"], t["id"], type_).status_code == 422


def test_type_d_un_lien_de_projet_non_modifiable(client, auth, fabrique, deux_projets):
    p1, p2 = deux_projets
    t = fabrique.tache(p2["id"])
    dep = _lien_projet(client, auth, p1["id"], t["id"]).json()
    r = client.put(f"/api/dependencies/{dep['id']}", json={"type": "SS"}, headers=auth)
    assert r.status_code == 422


@pytest.mark.parametrize(
    "corps",
    [
        {},  # aucun prédécesseur
        {"tache_amont_id": 1, "projet_amont_id": 1},  # les deux
    ],
)
def test_exactement_un_predecesseur(client, auth, fabrique, deux_projets, corps):
    _, p2 = deux_projets
    t = fabrique.tache(p2["id"])
    r = client.post(
        "/api/dependencies", json={**corps, "tache_aval_id": t["id"]}, headers=auth
    )
    assert r.status_code == 422


def test_projet_amont_inconnu(client, auth, fabrique, deux_projets):
    _, p2 = deux_projets
    t = fabrique.tache(p2["id"])
    assert _lien_projet(client, auth, 9999, t["id"]).status_code == 404


def test_supprimer_le_projet_retire_le_lien(client, auth, fabrique, deux_projets):
    p1, p2 = deux_projets
    t = fabrique.tache(p2["id"])
    assert _lien_projet(client, auth, p1["id"], t["id"]).status_code == 201
    assert client.delete(f"/api/projects/{p1['id']}", headers=auth).status_code == 204
    assert client.get("/api/dependencies", headers=auth).json() == []


# --- Unitaire : la fonction d'invariant elle-même ---------------------------


class _Dep:
    def __init__(self, aval, tache_amont=None, projet_amont=None):
        self.tache_amont_id = tache_amont
        self.projet_amont_id = projet_amont
        self.tache_aval_id = aval
        self.type = "FS"


def test_unitaire_arete_implicite_tache_vers_fin_de_projet():
    # Projet 1 = {tâche 1}. Projet 1 → tâche 2, tâche 2 → tâche 1 : cycle.
    with pytest.raises(InvariantError) as exc:
        check_dependency_acyclic(
            [_Dep(2, projet_amont=1)],
            new_edge=_Dep(1, tache_amont=2),
            taches_par_projet={1: [1], 2: [2]},
        )
    assert exc.value.code == "INV-14"


def test_unitaire_projet_et_tache_de_meme_id_ne_se_confondent_pas():
    """Le projet 1 et la tâche 1 sont deux nœuds distincts du graphe."""
    check_dependency_acyclic(
        [_Dep(2, projet_amont=1), _Dep(1, tache_amont=2)],
        taches_par_projet={1: [3]},
    )
