"""Liste de contrôle d'une tâche — ce qu'elle est, et ce qu'elle n'est pas.

Retour d'usage : « avoir une liste des todo dans une tâche ». Ce sont des points
à cocher, PAS des sous-tâches : la hiérarchie du produit s'arrête à
Epic → Projet → Tâche, et tout ce qui porte des dates, un responsable ou des
dépendances est une tâche. Un todo ne pèse sur aucun planning, aucune charge,
aucun invariant — c'est ce que ces tests vérifient autant que le CRUD lui-même.
"""


def _todo(client, auth, tache_id: int, libelle: str = "Visser les boulons"):
    r = client.post("/api/todos", json={"tache_id": tache_id, "libelle": libelle}, headers=auth)
    assert r.status_code == 201, r.text
    return r.json()


def test_cycle_complet(client, auth, fabrique):
    fabrique.epic()
    p = fabrique.projet()
    t = fabrique.tache(p["id"])

    cree = _todo(client, auth, t["id"])
    assert cree["fait"] is False  # rien n'est fait à la création

    # Cocher : on n'envoie QUE `fait`. Le libellé doit survivre — c'est le sens
    # d'`exclude_unset`, et l'inverse effacerait la ligne en la cochant.
    r = client.put(f"/api/todos/{cree['id']}", json={"fait": True}, headers=auth)
    assert r.status_code == 200, r.text
    assert r.json()["fait"] is True
    assert r.json()["libelle"] == "Visser les boulons"

    # Renommer sans décocher : la réciproque.
    r = client.put(f"/api/todos/{cree['id']}", json={"libelle": "Serrer les boulons"}, headers=auth)
    assert r.json() == {**r.json(), "libelle": "Serrer les boulons", "fait": True}

    assert client.delete(f"/api/todos/{cree['id']}", headers=auth).status_code == 204
    assert client.get(f"/api/todos?tache_id={t['id']}", headers=auth).json() == []


def test_liste_filtree_par_tache_et_ordonnee(client, auth, fabrique):
    fabrique.epic()
    p = fabrique.projet()
    t1 = fabrique.tache(p["id"], nom="Une")
    t2 = fabrique.tache(p["id"], nom="Deux")
    _todo(client, auth, t1["id"], "premier")
    _todo(client, auth, t1["id"], "second")
    _todo(client, auth, t2["id"], "ailleurs")

    liste = client.get(f"/api/todos?tache_id={t1['id']}", headers=auth).json()
    # Ordre de création : la liste n'a pas de rang propre, et une liste de contrôle
    # qui se réordonne toute seule serait déroutante.
    assert [x["libelle"] for x in liste] == ["premier", "second"]


# La suppression est la SEULE de l'API ouverte aux membres. Ailleurs elle est
# réservée aux administrateurs à cause de sa portée — les clés étrangères sont en
# cascade sur toute la hiérarchie. Un todo n'a rien en dessous de lui et n'est
# référencé par rien : le supprimer n'emporte que lui-même. À quoi s'ajoute
# l'usage — c'est la liste qu'on coche en faisant le travail, et une ligne mal
# saisie qu'il faudrait faire retirer par un administrateur rendrait l'outil pénible.
def test_un_membre_peut_cocher_ajouter_et_retirer(client, auth, auth_membre, fabrique):
    fabrique.epic()
    p = fabrique.projet()
    t = fabrique.tache(p["id"])

    r = client.post("/api/todos", json={"tache_id": t["id"], "libelle": "Purger"}, headers=auth_membre)
    assert r.status_code == 201, r.text
    todo = r.json()
    assert client.put(f"/api/todos/{todo['id']}", json={"fait": True}, headers=auth_membre).status_code == 200
    assert client.delete(f"/api/todos/{todo['id']}", headers=auth_membre).status_code == 204


def test_tache_inconnue_refusee(client, auth):
    r = client.post("/api/todos", json={"tache_id": 9999, "libelle": "X"}, headers=auth)
    assert r.status_code == 404


def test_libelle_vide_refuse(client, auth, fabrique):
    fabrique.epic()
    p = fabrique.projet()
    t = fabrique.tache(p["id"])
    assert client.post("/api/todos", json={"tache_id": t["id"], "libelle": ""}, headers=auth).status_code == 422


def test_supprimer_la_tache_emporte_ses_todos(client, auth, fabrique):
    """La liste n'existe qu'attachée à sa tâche (ON DELETE CASCADE).

    La conserver laisserait des lignes que plus rien ne désigne, et que rien dans
    l'interface ne permettrait de retrouver.
    """
    fabrique.epic()
    p = fabrique.projet()
    t = fabrique.tache(p["id"])
    _todo(client, auth, t["id"])
    assert len(client.get(f"/api/todos?tache_id={t['id']}", headers=auth).json()) == 1

    assert client.delete(f"/api/tasks/{t['id']}", headers=auth).status_code == 204
    assert client.get(f"/api/todos?tache_id={t['id']}", headers=auth).json() == []
