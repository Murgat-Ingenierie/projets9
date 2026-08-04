"""Mise à jour d'un jalon — ce que l'absence d'un champ doit vouloir dire.

Écrit après une fausse alerte : l'inventaire annonçait depuis le 17 juillet que
« l'édition inline perd les `project_ids` ». C'est faux — la route emploie
`exclude_unset=True` et ne touche aux rattachements que si le champ est
FOURNI — mais rien ne le vérifiait, et l'affirmation a survécu des semaines.

Ce qui est en jeu n'est pas mince : les rattachements d'un jalon portent
désormais deux signaux du planning, le repère vertical à sa date et le hachurage
des barres qui le dépassent. Les perdre en silence effacerait les deux.

La distinction éprouvée ici est celle entre « champ ABSENT » (ne pas y toucher)
et « champ FOURNI » (remplacer) — deux sens qu'un `model_dump()` sans
`exclude_unset` confondrait, en remplaçant par la valeur par défaut.
"""


def test_maj_partielle_conserve_les_rattachements(client, auth, fabrique):
    """Un PUT sans `project_ids` ne détache pas le jalon.

    C'est exactement ce qu'envoie l'édition inline de l'écran Jalons : nom, date
    et « atteint », rien d'autre.
    """
    fabrique.epic()
    p1 = fabrique.projet(nom="Un")
    p2 = fabrique.projet(nom="Deux")
    j = fabrique.jalon([p1["id"], p2["id"]])
    assert sorted(j["project_ids"]) == sorted([p1["id"], p2["id"]])

    r = client.put(f"/api/milestones/{j['id']}", json={"nom": "Renommé"}, headers=auth)
    assert r.status_code == 200, r.text
    assert r.json()["nom"] == "Renommé"
    assert sorted(r.json()["project_ids"]) == sorted([p1["id"], p2["id"]])


def test_maj_explicite_remplace_les_rattachements(client, auth, fabrique):
    """Fournir `project_ids` REMPLACE la liste : c'est le seul moyen de la changer.

    Le versant nécessaire du test précédent — sans lui, « ne jamais toucher aux
    rattachements » le satisferait aussi, et l'édition deviendrait impossible.
    """
    fabrique.epic()
    p1 = fabrique.projet(nom="Un")
    p2 = fabrique.projet(nom="Deux")
    j = fabrique.jalon([p1["id"], p2["id"]])

    r = client.put(f"/api/milestones/{j['id']}", json={"project_ids": [p2["id"]]}, headers=auth)
    assert r.status_code == 200, r.text
    assert r.json()["project_ids"] == [p2["id"]]


def test_une_liste_vide_est_refusee(client, auth, fabrique):
    """INV-6 : un jalon reste rattaché à au moins un projet.

    Détacher explicitement n'est pas une opération permise — d'où l'importance
    que l'ABSENCE du champ ne soit pas lue comme une liste vide.
    """
    fabrique.epic()
    p = fabrique.projet()
    j = fabrique.jalon([p["id"]])

    r = client.put(f"/api/milestones/{j['id']}", json={"project_ids": []}, headers=auth)
    assert r.status_code == 422, r.text
