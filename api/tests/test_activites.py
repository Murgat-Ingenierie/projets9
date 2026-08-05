"""Journal d'activité — une trace, pas une note.

Ce que ces tests protègent n'est pas le CRUD : c'est ce qui MANQUE. Il n'existe
aucune route de modification, et la suppression est réservée aux administrateurs.
Sans ces deux propriétés, « j'ai vissé les boulons » daté et signé redeviendrait
un champ de texte comme un autre — réécrivable, donc sans valeur de compte rendu.
"""


def _ecrire(client, headers, tache_id: int, texte: str = "J'ai vissé les boulons"):
    r = client.post("/api/activites", json={"tache_id": tache_id, "texte": texte}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def test_ecrire_horodate_et_signe(client, auth, fabrique):
    fabrique.epic()
    p = fabrique.projet()
    t = fabrique.tache(p["id"])

    e = _ecrire(client, auth, t["id"])
    assert e["texte"] == "J'ai vissé les boulons"
    assert e["auteur_nom"]  # signé
    assert e["created_at"]  # horodaté


def test_la_signature_vient_du_jeton_pas_du_corps(client, auth, membre, auth_membre, fabrique):
    """Fournir un auteur dans la requête ne doit pas permettre d'écrire au nom d'un autre."""
    fabrique.epic()
    p = fabrique.projet()
    t = fabrique.tache(p["id"])

    r = client.post(
        "/api/activites",
        json={"tache_id": t["id"], "texte": "X", "auteur_id": 999, "auteur_nom": "Quelqu'un d'autre"},
        headers=auth_membre,
    )
    assert r.status_code == 201, r.text
    assert r.json()["auteur_id"] == membre.id
    assert r.json()["auteur_nom"] != "Quelqu'un d'autre"


def test_aucune_route_ne_modifie_une_entree(client, auth, fabrique):
    """L'immuabilité est le sujet : le PUT et le PATCH ne doivent pas exister."""
    fabrique.epic()
    p = fabrique.projet()
    t = fabrique.tache(p["id"])
    e = _ecrire(client, auth, t["id"])

    for methode in (client.put, client.patch):
        r = methode(f"/api/activites/{e['id']}", json={"texte": "réécrit"}, headers=auth)
        assert r.status_code == 405, f"{methode} devrait être refusée, reçu {r.status_code}"

    assert client.get(f"/api/activites?tache_id={t['id']}", headers=auth).json()[0]["texte"] == (
        "J'ai vissé les boulons"
    )


def test_un_membre_ecrit_mais_ne_supprime_pas(client, auth_membre, fabrique):
    """Sinon l'immuabilité serait illusoire : supprimer puis republier = réécrire."""
    fabrique.epic()
    p = fabrique.projet()
    t = fabrique.tache(p["id"])
    e = _ecrire(client, auth_membre, t["id"])

    assert client.delete(f"/api/activites/{e['id']}", headers=auth_membre).status_code == 403


def test_un_administrateur_peut_supprimer(client, auth, fabrique):
    """Une saisie sur la mauvaise tâche, ça arrive : la correction reste possible."""
    fabrique.epic()
    p = fabrique.projet()
    t = fabrique.tache(p["id"])
    e = _ecrire(client, auth, t["id"])

    assert client.delete(f"/api/activites/{e['id']}", headers=auth).status_code == 204
    assert client.get(f"/api/activites?tache_id={t['id']}", headers=auth).json() == []


def test_la_plus_recente_en_tete(client, auth, fabrique):
    fabrique.epic()
    p = fabrique.projet()
    t = fabrique.tache(p["id"])
    _ecrire(client, auth, t["id"], "d'abord")
    _ecrire(client, auth, t["id"], "ensuite")

    liste = client.get(f"/api/activites?tache_id={t['id']}", headers=auth).json()
    # On ouvre une tâche pour savoir où elle en est, pas pour relire son histoire
    # depuis le début.
    assert [e["texte"] for e in liste] == ["ensuite", "d'abord"]


def test_texte_vide_refuse(client, auth, fabrique):
    fabrique.epic()
    p = fabrique.projet()
    t = fabrique.tache(p["id"])
    assert client.post(
        "/api/activites", json={"tache_id": t["id"], "texte": ""}, headers=auth
    ).status_code == 422


def test_tache_inconnue_refusee(client, auth):
    assert client.post(
        "/api/activites", json={"tache_id": 9999, "texte": "X"}, headers=auth
    ).status_code == 404


def test_supprimer_la_tache_emporte_son_journal(client, auth, fabrique):
    fabrique.epic()
    p = fabrique.projet()
    t = fabrique.tache(p["id"])
    _ecrire(client, auth, t["id"])

    assert client.delete(f"/api/tasks/{t['id']}", headers=auth).status_code == 204
    assert client.get(f"/api/activites?tache_id={t['id']}", headers=auth).json() == []
