"""Phase 2 — tests d'intégration des invariants, via l'API.

Complète `test_invariants_unit.py` : l'unitaire prouve que la fonction `check_*`
dit vrai, l'intégration prouve que **la route l'appelle réellement** et surface le
bon code au client. Les deux sont nécessaires — INV-9 était un check correct que
plus personne n'appelait, et rien ne l'a vu.

Couvre en particulier les 4 invariants **sans fonction `check_*`**, qui ne peuvent
être testés qu'ici : INV-4, INV-5 (références), INV-AUTH-1 (unicité email),
INV-21 (audit).

Convention : chaque test invalide assert le **code** `INV-X`, pas seulement le
statut HTTP.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.conftest import code_de

# --- INV-1 : trigramme ------------------------------------------------------


def test_inv1_api_accepte_trigramme_valide(client: TestClient, auth) -> None:
    r = client.post(
        "/api/epics",
        json={"trigramme": "O50", "nom": "Objectif 50%", "statut": "idee",
              "categorie": "operationnel"},
        headers=auth,
    )
    assert r.status_code == 201, r.text
    assert r.json()["trigramme"] == "O50"


def test_inv1_api_refuse_trigramme_invalide(client: TestClient, auth) -> None:
    """422 et non 409 : le pattern est porté par le schéma Pydantic, qui refuse
    avant la route. Convention documentée en SPEC §3."""
    r = client.post(
        "/api/epics",
        json={"trigramme": "abc", "nom": "X", "statut": "idee",
              "categorie": "operationnel"},
        headers=auth,
    )
    assert r.status_code == 422, r.text


def test_inv1_api_refuse_trigramme_duplique(client: TestClient, auth, fabrique) -> None:
    fabrique.epic("ABC")
    r = client.post(
        "/api/epics",
        json={"trigramme": "ABC", "nom": "Doublon", "statut": "idee",
              "categorie": "operationnel"},
        headers=auth,
    )
    assert r.status_code == 409, r.text


# --- INV-2 / INV-3 : Epic ---------------------------------------------------


def test_inv2_api_refuse_nom_vide(client: TestClient, auth) -> None:
    r = client.post(
        "/api/epics",
        json={"trigramme": "ABC", "nom": "   ", "statut": "idee",
              "categorie": "operationnel"},
        headers=auth,
    )
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-2"


def test_inv3_api_refuse_actif_sans_critere(client: TestClient, auth) -> None:
    r = client.post(
        "/api/epics",
        json={"trigramme": "ABC", "nom": "Un epic", "statut": "actif",
              "categorie": "operationnel"},
        headers=auth,
    )
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-3"


def test_inv3_api_accepte_actif_avec_critere(client: TestClient, auth) -> None:
    r = client.post(
        "/api/epics",
        json={"trigramme": "ABC", "nom": "Un epic", "statut": "actif",
              "categorie": "operationnel", "critere_reussite": "Passer à 250 l/s"},
        headers=auth,
    )
    assert r.status_code == 201, r.text


# --- INV-4 : toute Tâche référence un Projet existant -----------------------
# Pas de fonction check_* : invariant porté en ligne par la route.


def test_inv4_api_refuse_projet_inconnu(client: TestClient, auth) -> None:
    r = client.post(
        "/api/tasks",
        json={"projet_id": 999999, "nom": "T", "date_debut": "2026-08-01",
              "date_fin": "2026-08-10"},
        headers=auth,
    )
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-4"


# --- INV-5 : tout Projet référence un Epic existant -------------------------


def test_inv5_api_refuse_epic_inconnu(client: TestClient, auth) -> None:
    r = client.post(
        "/api/projects",
        json={"epic_trigramme": "ZZZ", "nom": "P", "date_debut": "2026-08-01",
              "date_fin": "2026-08-31"},
        headers=auth,
    )
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-5"


# --- INV-6 : un jalon est rattaché à ≥ 1 projet -----------------------------


def test_inv6_api_refuse_jalon_sans_projet(client: TestClient, auth, fabrique) -> None:
    """422 et non 409 : `project_ids` porte `min_length=1` sur MilestoneCreate ET
    MilestoneUpdate, donc le schéma refuse avant la route. Même convention
    qu'INV-1. `check_milestone_has_projects` est de ce fait inatteignable par
    ce chemin — il reste la définition testable de la règle (test unitaire)."""
    fabrique.epic("ABC")
    r = client.post(
        "/api/milestones",
        json={"nom": "J", "date": "2026-08-15", "project_ids": []},
        headers=auth,
    )
    assert r.status_code == 422, r.text


def test_inv6_api_refuse_de_vider_les_projets_en_put(
    client: TestClient, auth, fabrique
) -> None:
    fabrique.epic("ABC")
    p = fabrique.projet("ABC")
    j = fabrique.jalon([p["id"]])
    r = client.put(
        f"/api/milestones/{j['id']}", json={"project_ids": []}, headers=auth
    )
    assert r.status_code == 422, r.text


def test_inv6_api_supprimer_le_dernier_projet_d_un_jalon_est_refuse(
    client: TestClient, auth, fabrique
) -> None:
    """Régression : INV-6 doit tenir après TOUTE mutation, y compris la
    suppression du dernier projet porteur d'un jalon. Était un xfail(strict)
    tant que la suppression orphelinait le jalon en silence."""
    fabrique.epic("ABC")
    p = fabrique.projet("ABC")
    j = fabrique.jalon([p["id"]])

    r = client.delete(f"/api/projects/{p['id']}", headers=auth)
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-6"

    # Le jalon survit, toujours rattaché à son projet.
    jalons = {m["id"]: m for m in client.get("/api/milestones", headers=auth).json()}
    assert jalons[j["id"]]["project_ids"] == [p["id"]]


def test_inv6_api_supprimer_un_projet_parmi_d_autres_reste_permis(
    client: TestClient, auth, fabrique
) -> None:
    """Supprimer un projet qui n'est PAS le seul rattachement d'un jalon doit
    rester possible : le jalon garde ses autres projets."""
    fabrique.epic("ABC")
    p1 = fabrique.projet("ABC", nom="P1")
    p2 = fabrique.projet("ABC", nom="P2")
    j = fabrique.jalon([p1["id"], p2["id"]])

    r = client.delete(f"/api/projects/{p1['id']}", headers=auth)
    assert r.status_code == 204, r.text

    jalons = {m["id"]: m for m in client.get("/api/milestones", headers=auth).json()}
    assert jalons[j["id"]]["project_ids"] == [p2["id"]]


def test_inv6_api_supprimer_un_epic_qui_orphelinerait_un_jalon_est_refuse(
    client: TestClient, auth, fabrique
) -> None:
    """Second chemin d'orphelinage : supprimer un epic cascade sur ses projets.
    Doit être refusé si un jalon n'a de projets que dans cet epic."""
    fabrique.epic("ABC")
    p = fabrique.projet("ABC")
    fabrique.jalon([p["id"]])

    r = client.delete("/api/epics/ABC", headers=auth)
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-6"


def test_inv6_api_accepte_jalon_multi_projets(client: TestClient, auth, fabrique) -> None:
    fabrique.epic("ABC")
    p1 = fabrique.projet("ABC", nom="P1")
    p2 = fabrique.projet("ABC", nom="P2")
    j = fabrique.jalon([p1["id"], p2["id"]])
    assert sorted(j["project_ids"]) == sorted([p1["id"], p2["id"]])


# --- INV-7 : dates de tâche -------------------------------------------------


def test_inv7_api_refuse_dates_inversees(client: TestClient, auth, fabrique) -> None:
    fabrique.epic("ABC")
    p = fabrique.projet("ABC")
    r = client.post(
        "/api/tasks",
        json={"projet_id": p["id"], "nom": "T", "date_debut": "2026-08-10",
              "date_fin": "2026-08-01"},
        headers=auth,
    )
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-7"


def test_inv7_api_refuse_aussi_en_put(client: TestClient, auth, fabrique) -> None:
    fabrique.epic("ABC")
    p = fabrique.projet("ABC")
    t = fabrique.tache(p["id"])
    r = client.put(
        f"/api/tasks/{t['id']}",
        json={"date_debut": "2026-09-01", "date_fin": "2026-08-01"},
        headers=auth,
    )
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-7"


# --- INV-8 : dates de projet ------------------------------------------------


def test_inv8_api_refuse_dates_inversees(client: TestClient, auth, fabrique) -> None:
    fabrique.epic("ABC")
    r = client.post(
        "/api/projects",
        json={"epic_trigramme": "ABC", "nom": "P", "date_debut": "2026-09-30",
              "date_fin": "2026-09-01"},
        headers=auth,
    )
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-8"


# --- INV-9 : SUPPRIMÉ — la mutation doit être ACCEPTÉE ----------------------


def test_inv9_api_accepte_tache_hors_fenetre_du_projet(
    client: TestClient, auth, fabrique
) -> None:
    """INV-9 a été retiré (SPEC §3) : le Gantt signale par une hachure rouge,
    l'API ne refuse plus. Ce test verrouille le non-invariant — si quelqu'un
    ré-appliquait la règle, il tomberait."""
    fabrique.epic("ABC")
    p = fabrique.projet("ABC")  # 01/08 → 31/08
    r = client.post(
        "/api/tasks",
        json={"projet_id": p["id"], "nom": "Hors fenêtre",
              "date_debut": "2026-07-01", "date_fin": "2026-12-31"},
        headers=auth,
    )
    assert r.status_code == 201, r.text


# --- INV-10 : Projet.date_fin ≤ Epic.date_fin_prévue ------------------------


def test_inv10_api_refuse_projet_hors_borne(client: TestClient, auth, fabrique) -> None:
    fabrique.epic("ABC", date_fin_prevue="2026-12-31")
    r = client.post(
        "/api/projects",
        json={"epic_trigramme": "ABC", "nom": "P", "date_debut": "2026-08-01",
              "date_fin": "2027-01-01"},
        headers=auth,
    )
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-10"


# --- INV-11 : Jalon.date ≤ Epic.jalon_fin_max -------------------------------


def test_inv11_api_refuse_jalon_hors_borne(client: TestClient, auth, fabrique) -> None:
    fabrique.epic("ABC", jalon_fin_max="2026-12-31")
    p = fabrique.projet("ABC")
    r = client.post(
        "/api/milestones",
        json={"nom": "J", "date": "2027-06-01", "project_ids": [p["id"]]},
        headers=auth,
    )
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-11"


# --- INV-12 : date_fin_prévue ≤ jalon_fin_max -------------------------------


def test_inv12_api_refuse_ordre_inverse(client: TestClient, auth) -> None:
    r = client.post(
        "/api/epics",
        json={"trigramme": "ABC", "nom": "E", "statut": "idee",
              "categorie": "operationnel", "date_fin_prevue": "2027-01-01",
              "jalon_fin_max": "2026-12-31"},
        headers=auth,
    )
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-12"


# --- INV-14 / INV-15 : graphe des dépendances -------------------------------


def test_inv14_api_refuse_cycle(client: TestClient, auth, fabrique) -> None:
    fabrique.epic("ABC")
    p = fabrique.projet("ABC")
    t1 = fabrique.tache(p["id"], nom="T1")
    t2 = fabrique.tache(p["id"], nom="T2")
    r = client.post(
        "/api/dependencies",
        json={"tache_amont_id": t1["id"], "tache_aval_id": t2["id"], "type": "FS"},
        headers=auth,
    )
    assert r.status_code == 201, r.text
    r = client.post(
        "/api/dependencies",
        json={"tache_amont_id": t2["id"], "tache_aval_id": t1["id"], "type": "FS"},
        headers=auth,
    )
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-14"


def test_inv15_api_refuse_auto_dependance(client: TestClient, auth, fabrique) -> None:
    fabrique.epic("ABC")
    p = fabrique.projet("ABC")
    t = fabrique.tache(p["id"])
    r = client.post(
        "/api/dependencies",
        json={"tache_amont_id": t["id"], "tache_aval_id": t["id"], "type": "FS"},
        headers=auth,
    )
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-15"


# --- INV-13 : SUPPRIMÉ — la dépendance anti-chronologique est ACCEPTÉE ------


def test_inv13_api_accepte_dependance_anti_chronologique(
    client: TestClient, auth, fabrique
) -> None:
    """INV-13 retiré (SPEC §3) : aucune contrainte de dates entre tâches
    dépendantes. Verrouille le non-invariant."""
    fabrique.epic("ABC")
    p = fabrique.projet("ABC")
    tard = fabrique.tache(p["id"], nom="Tard", date_debut="2026-08-20",
                          date_fin="2026-08-25")
    tot = fabrique.tache(p["id"], nom="Tôt", date_debut="2026-08-01",
                         date_fin="2026-08-05")
    r = client.post(
        "/api/dependencies",
        json={"tache_amont_id": tard["id"], "tache_aval_id": tot["id"], "type": "FS"},
        headers=auth,
    )
    assert r.status_code == 201, r.text


# --- INV-18 : Projet réalisé ⇒ tâches archivées -----------------------------


def test_inv18_api_refuse_realise_avec_tache_ouverte(
    client: TestClient, auth, fabrique
) -> None:
    fabrique.epic("ABC")
    p = fabrique.projet("ABC")
    fabrique.tache(p["id"], statut="ouvert")
    r = client.put(f"/api/projects/{p['id']}", json={"statut": "realise"}, headers=auth)
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-18"


def test_inv18_api_accepte_realise_si_tout_archive(
    client: TestClient, auth, fabrique
) -> None:
    fabrique.epic("ABC")
    p = fabrique.projet("ABC")
    fabrique.tache(p["id"], statut="archive")
    r = client.put(f"/api/projects/{p['id']}", json={"statut": "realise"}, headers=auth)
    assert r.status_code == 200, r.text


# --- INV-19 : Epic réalisé ⇒ projets terminés ET jalons atteints ------------


def test_inv19_api_refuse_realise_avec_projet_en_cours(
    client: TestClient, auth, fabrique
) -> None:
    fabrique.epic("ABC")
    fabrique.projet("ABC")  # statut prevu
    r = client.put("/api/epics/ABC", json={"statut": "realise"}, headers=auth)
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-19"


def test_inv19_api_refuse_realise_avec_jalon_non_atteint(
    client: TestClient, auth, fabrique
) -> None:
    fabrique.epic("ABC")
    p = fabrique.projet("ABC", statut="abandonne")
    fabrique.jalon([p["id"]], atteint=False)
    r = client.put("/api/epics/ABC", json={"statut": "realise"}, headers=auth)
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-19"


# --- INV-20 : unité cohérente par Epic --------------------------------------


def test_inv20_api_refuse_unite_incoherente(client: TestClient, auth, fabrique) -> None:
    fabrique.epic("ABC")
    r = client.post(
        "/api/measures",
        json={"epic_trigramme": "ABC", "date": "2026-08-01", "valeur": 250,
              "unite": "l/s"},
        headers=auth,
    )
    assert r.status_code == 201, r.text
    r = client.post(
        "/api/measures",
        json={"epic_trigramme": "ABC", "date": "2026-08-02", "valeur": 12,
              "unite": "kg"},
        headers=auth,
    )
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-20"


# --- INV-21 : toute mutation met à jour updated_at / updated_by -------------
# Pas de fonction check_* : propriété des routes, seul l'API peut la prouver.


def test_inv21_api_creation_renseigne_l_audit(
    client: TestClient, auth, admin, fabrique
) -> None:
    e = fabrique.epic("ABC")
    assert e["created_at"] is not None
    assert e["updated_at"] is not None
    assert e["updated_by_id"] == admin.id


def test_inv21_api_update_avance_updated_at(client: TestClient, auth, fabrique) -> None:
    e = fabrique.epic("ABC")
    avant = e["updated_at"]
    r = client.put("/api/epics/ABC", json={"nom": "Renommé"}, headers=auth)
    assert r.status_code == 200, r.text
    assert r.json()["updated_at"] > avant, "updated_at n'a pas avancé"


def test_inv21_api_update_renseigne_updated_by(
    client: TestClient, auth, admin, fabrique
) -> None:
    fabrique.epic("ABC")
    r = client.put("/api/epics/ABC", json={"nom": "Renommé"}, headers=auth)
    assert r.status_code == 200, r.text
    assert r.json()["updated_by_id"] == admin.id


# --- INV-AUTH-1 : email unique, insensible à la casse -----------------------


def test_inv_auth1_api_refuse_email_duplique_casse_differente(
    client: TestClient, auth
) -> None:
    r = client.post(
        "/api/users",
        json={"nom": "A", "email": "dupe@exemple.fr", "password": "motdepasse1",
              "role": "membre"},
        headers=auth,
    )
    assert r.status_code == 201, r.text
    r = client.post(
        "/api/users",
        json={"nom": "B", "email": "DUPE@EXEMPLE.FR", "password": "motdepasse2",
              "role": "membre"},
        headers=auth,
    )
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-AUTH-1"


def test_inv_auth1_api_accepte_le_domaine_local_du_projet(
    client: TestClient, auth
) -> None:
    """Régression C11 : l'app doit savoir créer un compte suivant sa propre
    convention (SEED_ADMIN_EMAIL=…@lesfontaines.local dans .env.example).
    Était un xfail(strict) tant que UserCreate.email restait un EmailStr —
    email-validator refusant les TLD réservés comme .local."""
    r = client.post(
        "/api/users",
        json={"nom": "Second admin", "email": "second@lesfontaines.local",
              "password": "motdepasse1", "role": "membre"},
        headers=auth,
    )
    assert r.status_code == 201, r.text
    assert r.json()["email"] == "second@lesfontaines.local"


@pytest.mark.parametrize("email", ["pas-un-email", "sans@point", "a b@c.fr", "@lesfontaines.fr"])
def test_email_casse_refuse_a_la_creation(client: TestClient, auth, email: str) -> None:
    """Le validateur maison tolère .local mais reste un vrai contrôle : un
    format cassé doit toujours être refusé (422), pas tout accepter."""
    r = client.post(
        "/api/users",
        json={"nom": "X", "email": email, "password": "motdepasse1", "role": "membre"},
        headers=auth,
    )
    assert r.status_code == 422, r.text


# --- INV-AUTH-3 : au moins un admin actif -----------------------------------


def test_inv_auth3_api_refuse_suppression_du_dernier_admin(
    client: TestClient, auth, admin
) -> None:
    r = client.delete(f"/api/users/{admin.id}", headers=auth)
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-AUTH-3"


def test_inv_auth3_api_refuse_retrogradation_du_dernier_admin(
    client: TestClient, auth, admin
) -> None:
    r = client.put(f"/api/users/{admin.id}", json={"role": "membre"}, headers=auth)
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-AUTH-3"


def test_inv_auth3_api_refuse_desactivation_du_dernier_admin(
    client: TestClient, auth, admin
) -> None:
    r = client.put(f"/api/users/{admin.id}", json={"actif": False}, headers=auth)
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-AUTH-3"


# --- INV-EQ-* : équipes et allocations --------------------------------------


def test_inv_eq1a_api_refuse_nom_blanc(client: TestClient, auth) -> None:
    r = client.post(
        "/api/equipes", json={"nom": "   ", "temps_dispo_hebdo": 35}, headers=auth
    )
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-EQ-1a"


def test_inv_eq1b_api_refuse_doublon_de_casse(client: TestClient, auth, fabrique) -> None:
    fabrique.equipe("Maintenance")
    r = client.post(
        "/api/equipes", json={"nom": "MAINTENANCE", "temps_dispo_hebdo": 10}, headers=auth
    )
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-EQ-1b"


def test_inv_eq1b_api_autorise_renommage_de_sa_propre_casse(
    client: TestClient, auth, fabrique
) -> None:
    """Régression : sans exclusion de l'équipe courante, ce PUT échouerait."""
    eq = fabrique.equipe("Maintenance")
    r = client.put(f"/api/equipes/{eq['id']}", json={"nom": "MAINTENANCE"}, headers=auth)
    assert r.status_code == 200, r.text
    assert r.json()["nom"] == "MAINTENANCE"


def test_inv_eq2_api_refuse_temps_negatif(client: TestClient, auth) -> None:
    r = client.post(
        "/api/equipes", json={"nom": "E", "temps_dispo_hebdo": -1}, headers=auth
    )
    assert r.status_code == 422, r.text


def test_inv_eq3_api_refuse_heures_nulles(client: TestClient, auth, fabrique) -> None:
    fabrique.epic("ABC")
    p = fabrique.projet("ABC")
    t = fabrique.tache(p["id"])
    eq = fabrique.equipe()
    r = client.post(
        "/api/tache-equipe",
        json={"tache_id": t["id"], "equipe_id": eq["id"], "heures_allouees": 0},
        headers=auth,
    )
    assert r.status_code == 422, r.text


def test_inv_eq4_api_refuse_doublon_allocation(client: TestClient, auth, fabrique) -> None:
    fabrique.epic("ABC")
    p = fabrique.projet("ABC")
    t = fabrique.tache(p["id"])
    eq = fabrique.equipe()
    corps = {"tache_id": t["id"], "equipe_id": eq["id"], "heures_allouees": 5}
    assert client.post("/api/tache-equipe", json=corps, headers=auth).status_code == 201
    r = client.post("/api/tache-equipe", json=corps, headers=auth)
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-EQ-4"


def test_inv_eq5_api_refuse_tache_inconnue(client: TestClient, auth, fabrique) -> None:
    eq = fabrique.equipe()
    r = client.post(
        "/api/tache-equipe",
        json={"tache_id": 999999, "equipe_id": eq["id"], "heures_allouees": 5},
        headers=auth,
    )
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-EQ-5"


def test_inv_eq5_api_refuse_equipe_inconnue(client: TestClient, auth, fabrique) -> None:
    fabrique.epic("ABC")
    p = fabrique.projet("ABC")
    t = fabrique.tache(p["id"])
    r = client.post(
        "/api/tache-equipe",
        json={"tache_id": t["id"], "equipe_id": 999999, "heures_allouees": 5},
        headers=auth,
    )
    assert r.status_code == 409, r.text
    assert code_de(r) == "INV-EQ-5"


# --- non-invariant délibéré : la surcharge d'équipe est ACCEPTÉE ------------


def test_non_invariant_surcharge_equipe_acceptee(
    client: TestClient, auth, fabrique
) -> None:
    """SPEC §3, « non-invariants délibérés » : le planning signale la surcharge
    en rouge, l'API ne la refuse pas. Verrouille le parti pris."""
    fabrique.epic("ABC")
    p = fabrique.projet("ABC")
    t = fabrique.tache(p["id"])
    eq = fabrique.equipe(nom="Petite équipe", temps_dispo_hebdo=1)
    r = client.post(
        "/api/tache-equipe",
        json={"tache_id": t["id"], "equipe_id": eq["id"], "heures_allouees": 9999},
        headers=auth,
    )
    assert r.status_code == 201, r.text


# --- authentification -------------------------------------------------------


def test_api_refuse_sans_token(client: TestClient) -> None:
    r = client.get("/api/epics")
    assert r.status_code == 401, r.text


def test_api_refuse_token_invalide(client: TestClient) -> None:
    r = client.get("/api/epics", headers={"Authorization": "Bearer pas-un-jwt"})
    assert r.status_code == 401, r.text


def test_health_est_ouvert(client: TestClient) -> None:
    assert client.get("/api/health").status_code == 200
