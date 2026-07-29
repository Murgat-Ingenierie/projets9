"""C7 — les suppressions sont réservées aux administrateurs.

Décision de besoin, pas correction d'un défaut : la SPEC §6 autorisait jusqu'ici
tout membre à supprimer n'importe quoi. Ce qui a fait pencher la balance est la
**portée réelle** d'une suppression : les clés étrangères sont en CASCADE sur
toute la hiérarchie, donc un seul `DELETE /api/epics/{tri}` emporte les projets,
leurs tâches, et par ricochet dépendances, mesures et allocations. Sur les
données réelles, l'epic le plus fourni représentait 9 projets et 34 tâches.

Création et modification restent ouvertes à tout membre : c'est le travail
quotidien, et il est réversible. Seul l'irréversible est gardé.

Ces tests valent surtout par leur versant NÉGATIF (un membre est refusé) : sans
lui, la règle pourrait disparaître d'un endpoint sans que rien ne le signale.
"""

import pytest
from fastapi.testclient import TestClient

from app.models.user import User, UserRole

# `auth` (admin) et `auth_membre` (non-admin) viennent du conftest : elles
# injectent le compte en surchargeant `get_current_user`, sans jeton.


@pytest.fixture
def jeu(client: TestClient, auth: dict[str, str], fabrique):
    """Un jeu complet : c'est le membre qui le CRÉE — la création reste ouverte."""
    epic = fabrique.epic()
    projet = fabrique.projet()
    tache = fabrique.tache(projet["id"])
    equipe = fabrique.equipe()
    jalon = fabrique.jalon([projet["id"]])
    return {"epic": epic, "projet": projet, "tache": tache, "equipe": equipe, "jalon": jalon}


# --- ce qu'un membre NE PEUT PLUS faire --------------------------------------


def test_membre_ne_peut_pas_supprimer_un_epic(client, auth_membre, jeu):
    """Le cas qui a motivé la décision : cascade sur tout le sous-arbre."""
    r = client.delete(f"/api/epics/{jeu['epic']['trigramme']}", headers=auth_membre)
    assert r.status_code == 403


def test_membre_ne_peut_pas_supprimer_un_projet(client, auth_membre, jeu):
    assert client.delete(f"/api/projects/{jeu['projet']['id']}", headers=auth_membre).status_code == 403


def test_membre_ne_peut_pas_supprimer_une_tache(client, auth_membre, jeu):
    assert client.delete(f"/api/tasks/{jeu['tache']['id']}", headers=auth_membre).status_code == 403


def test_membre_ne_peut_pas_supprimer_un_jalon(client, auth_membre, jeu):
    assert client.delete(f"/api/milestones/{jeu['jalon']['id']}", headers=auth_membre).status_code == 403


def test_membre_ne_peut_pas_supprimer_une_equipe(client, auth_membre, jeu):
    assert client.delete(f"/api/equipes/{jeu['equipe']['id']}", headers=auth_membre).status_code == 403


def test_la_suppression_refusee_ne_detruit_rien(client, auth, auth_membre, jeu):
    """Un 403 doit être un refus, pas une suppression silencieuse à moitié faite."""
    tri = jeu["epic"]["trigramme"]
    assert client.delete(f"/api/epics/{tri}", headers=auth_membre).status_code == 403
    assert client.get(f"/api/epics/{tri}", headers=auth).status_code == 200
    assert client.get(f"/api/projects/{jeu['projet']['id']}", headers=auth).status_code == 200


# --- ce qu'un membre PEUT toujours faire (le travail quotidien) --------------


def test_membre_peut_toujours_creer(client, auth_membre):
    r = client.post(
        "/api/epics",
        json={"trigramme": "MEM", "nom": "Créé par un membre", "statut": "idee",
              "categorie": "operationnel"},
        headers=auth_membre,
    )
    assert r.status_code == 201


def test_membre_peut_toujours_modifier(client, auth_membre, jeu):
    r = client.put(
        f"/api/tasks/{jeu['tache']['id']}",
        json={"nom": "Renommée par un membre"},
        headers=auth_membre,
    )
    assert r.status_code == 200


# --- l'admin, lui, supprime ---------------------------------------------------


def test_admin_supprime_toujours(client, auth, jeu):
    assert client.delete(f"/api/tasks/{jeu['tache']['id']}", headers=auth).status_code == 204


# --- annuaire : la liste complète se ferme, le sélecteur reste utilisable -----


def test_membre_ne_peut_pas_enumerer_les_comptes(client, auth_membre):
    """Seul écart réel à la SPEC §6, désormais fermé."""
    assert client.get("/api/users", headers=auth_membre).status_code == 403


def test_membre_accede_a_l_annuaire_reduit(client, auth_membre):
    """Sinon on casserait l'affectation d'un responsable pour tout non-admin."""
    r = client.get("/api/users/annuaire", headers=auth_membre)
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_l_annuaire_n_expose_ni_email_ni_role(client, auth_membre):
    """C'est ce qui permet de l'ouvrir : il ne divulgue rien de sensible."""
    entree = client.get("/api/users/annuaire", headers=auth_membre).json()[0]
    assert set(entree) == {"id", "nom"}


def test_l_annuaire_ignore_les_comptes_desactives(client, auth, auth_membre, session_factory):
    """On ne doit pas pouvoir affecter du travail à quelqu'un qui n'a plus accès."""
    db = session_factory()
    u = User(nom="Parti", email="parti@test.local", password_hash="x",
             role=UserRole.membre, actif=False)
    db.add(u)
    db.commit()
    db.close()

    noms = [e["nom"] for e in client.get("/api/users/annuaire", headers=auth_membre).json()]
    assert "Parti" not in noms
