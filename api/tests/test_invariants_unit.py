"""Phase 2 — tests unitaires des invariants.

Un test au moins par ID `INV-X` de `docs/SPEC.md`, cas valides ET cas invalides,
conformément au plan du `README.md`.

Chaque test invalide assert le **code** levé, pas seulement le fait qu'une erreur
survienne : l'ID stable est le contrat entre la SPEC, l'API et le client. Un check
qui refuserait avec le mauvais code serait un bug silencieux.

Ces tests ne chargent ni SQLAlchemy ni la base : les checks sont purs et typés par
`Protocol`, on leur passe donc de simples dataclasses. C'est l'intention posée par
la docstring de `app/invariants/checks.py`.

Invariants non couverts ici, faute de fonction `check_*` dédiée — ils sont portés
par la base ou par les routes, et testés dans `test_invariants_api.py` :
INV-4, INV-5 (clés étrangères), INV-AUTH-1 (unicité email), INV-21 (audit).
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date

import pytest

from app.invariants import (
    InvariantError,
    check_allocation_heures,
    check_allocation_refs,
    check_allocation_unique,
    check_dependency_acyclic,
    check_dependency_no_self,
    check_epic_basics,
    check_epic_date_order,
    check_epic_realise_consistency,
    check_epic_trigramme,
    check_equipe_nom,
    check_equipe_nom_unique,
    check_equipe_temps_dispo,
    check_max_active_users,
    check_measure_unit_consistency,
    check_milestone_has_projects,
    check_milestone_within_epic_max,
    check_min_one_admin,
    check_project_dates,
    check_project_dates_within_epic,
    check_project_realise_consistency,
    check_task_dates,
)

# --- doublures : le minimum décrit par chaque Protocol de checks.py ----------


@dataclass
class FakeEpic:
    trigramme: str = "ABC"
    nom: str = "Un epic"
    statut: str = "idee"
    critere_reussite: str | None = None
    date_fin_prevue: date | None = None
    jalon_fin_max: date | None = None


@dataclass
class FakeProject:
    id: int = 1
    nom: str = "Un projet"
    epic_trigramme: str = "ABC"
    date_debut: date = date(2026, 8, 1)
    date_fin: date = date(2026, 8, 31)
    statut: str = "prevu"


@dataclass
class FakeTask:
    id: int = 1
    nom: str = "Une tâche"
    projet_id: int = 1
    date_debut: date = date(2026, 8, 1)
    date_fin: date = date(2026, 8, 10)
    statut: str = "ouvert"


@dataclass
class FakeMilestone:
    nom: str = "Un jalon"
    date: date = date(2026, 8, 15)
    atteint: bool = False


@dataclass
class FakeDependency:
    tache_amont_id: int = 1
    tache_aval_id: int = 2
    type: str = "FS"


@dataclass
class FakeUser:
    id: int = 1
    role: str = "membre"
    actif: bool = True


@dataclass
class FakeMeasure:
    epic_trigramme: str = "ABC"
    unite: str = "l/s"


def refuse(code: str, fn: Callable[..., None], *args, **kwargs) -> InvariantError:
    """Assert que `fn` refuse AVEC le code attendu, et retourne l'erreur."""
    with pytest.raises(InvariantError) as exc:
        fn(*args, **kwargs)
    assert exc.value.code == code, f"attendu {code}, obtenu {exc.value.code}"
    return exc.value


# --- INV-1 : trigramme unique et ^[A-Z0-9]{3}$ ------------------------------
# L'unicité est portée par la PK + un 409 dans la route (cf. test_invariants_api).


@pytest.mark.parametrize("trigramme", ["ABC", "O50", "123", "ZZZ", "A1B"])
def test_inv1_accepte_trigrammes_valides(trigramme: str) -> None:
    check_epic_trigramme(trigramme)


@pytest.mark.parametrize(
    "trigramme",
    [
        "ab",  # trop court
        "ABCD",  # trop long
        "abc",  # minuscules
        "A-C",  # caractère interdit
        "A C",  # espace
        "",  # vide
        "AÉC",  # accent
    ],
)
def test_inv1_refuse_trigrammes_invalides(trigramme: str) -> None:
    refuse("INV-1", check_epic_trigramme, trigramme)


# --- INV-2 : Epic.nom non vide après trim -----------------------------------


def test_inv2_accepte_nom_non_vide() -> None:
    check_epic_basics(FakeEpic(nom="Objectif 50%"))


@pytest.mark.parametrize("nom", ["", "   ", "\t", "\n  "])
def test_inv2_refuse_nom_vide(nom: str) -> None:
    refuse("INV-2", check_epic_basics, FakeEpic(nom=nom))


# --- INV-3 : Epic actif ⇒ critère_réussite non vide -------------------------


def test_inv3_accepte_actif_avec_critere() -> None:
    check_epic_basics(FakeEpic(statut="actif", critere_reussite="Passer à 250 l/s"))


@pytest.mark.parametrize("statut", ["idee", "realise", "abandonne"])
def test_inv3_critere_non_exige_hors_actif(statut: str) -> None:
    check_epic_basics(FakeEpic(statut=statut, critere_reussite=None))


@pytest.mark.parametrize("critere", [None, "", "   "])
def test_inv3_refuse_actif_sans_critere(critere: str | None) -> None:
    refuse("INV-3", check_epic_basics, FakeEpic(statut="actif", critere_reussite=critere))


# --- INV-AUTH-2 : au plus 10 users actifs -----------------------------------


@pytest.mark.parametrize("n", [0, 1, 9, 10])
def test_inv_auth2_accepte_jusqua_la_limite(n: int) -> None:
    check_max_active_users(n, limit=10)


@pytest.mark.parametrize("n", [11, 50])
def test_inv_auth2_refuse_au_dela(n: int) -> None:
    refuse("INV-AUTH-2", check_max_active_users, n, limit=10)


def test_inv_auth2_limite_configurable() -> None:
    check_max_active_users(3, limit=3)
    refuse("INV-AUTH-2", check_max_active_users, 4, limit=3)


# --- INV-AUTH-3 : au moins un admin actif après mutation --------------------


def test_inv_auth3_accepte_un_admin_actif() -> None:
    check_min_one_admin([FakeUser(id=1, role="admin", actif=True), FakeUser(id=2)])


@pytest.mark.parametrize(
    "users",
    [
        [],  # plus personne
        [FakeUser(id=1, role="membre", actif=True)],  # que des membres
        [FakeUser(id=1, role="admin", actif=False)],  # seul admin désactivé
    ],
    ids=["aucun_user", "que_des_membres", "admin_desactive"],
)
def test_inv_auth3_refuse_sans_admin_actif(users: list[FakeUser]) -> None:
    refuse("INV-AUTH-3", check_min_one_admin, users)


# --- INV-6 : un jalon est rattaché à ≥ 1 projet -----------------------------


@pytest.mark.parametrize("ids", [[1], [1, 2, 3]])
def test_inv6_accepte_au_moins_un_projet(ids: list[int]) -> None:
    check_milestone_has_projects(ids)


def test_inv6_refuse_jalon_orphelin() -> None:
    refuse("INV-6", check_milestone_has_projects, [])


# --- INV-7 : Tâche.date_début ≤ date_fin ------------------------------------


def test_inv7_accepte_dates_ordonnees() -> None:
    check_task_dates(FakeTask(date_debut=date(2026, 8, 1), date_fin=date(2026, 8, 10)))


def test_inv7_accepte_tache_d_un_jour() -> None:
    """Comparaison inclusive (SPEC §3, « unité : jour calendaire »)."""
    j = date(2026, 8, 1)
    check_task_dates(FakeTask(date_debut=j, date_fin=j))


def test_inv7_refuse_dates_inversees() -> None:
    e = refuse(
        "INV-7",
        check_task_dates,
        FakeTask(nom="T", date_debut=date(2026, 8, 10), date_fin=date(2026, 8, 1)),
    )
    assert "10/08/2026" in e.detail and "01/08/2026" in e.detail


# --- INV-8 : Projet.date_début ≤ date_fin -----------------------------------


def test_inv8_accepte_dates_ordonnees() -> None:
    check_project_dates(FakeProject(date_debut=date(2026, 8, 1), date_fin=date(2026, 8, 31)))


def test_inv8_accepte_projet_d_un_jour() -> None:
    j = date(2026, 8, 1)
    check_project_dates(FakeProject(date_debut=j, date_fin=j))


def test_inv8_refuse_dates_inversees() -> None:
    refuse(
        "INV-8",
        check_project_dates,
        FakeProject(date_debut=date(2026, 9, 30), date_fin=date(2026, 9, 1)),
    )


# --- INV-10 : Projet.date_fin ≤ Epic.date_fin_prévue (si définie) -----------


def test_inv10_sans_contrainte_si_epic_sans_date() -> None:
    check_project_dates_within_epic(
        FakeProject(date_fin=date(2099, 1, 1)), FakeEpic(date_fin_prevue=None)
    )


def test_inv10_accepte_projet_dans_la_borne() -> None:
    check_project_dates_within_epic(
        FakeProject(date_fin=date(2026, 8, 31)), FakeEpic(date_fin_prevue=date(2026, 12, 31))
    )


def test_inv10_accepte_egalite() -> None:
    j = date(2026, 12, 31)
    check_project_dates_within_epic(FakeProject(date_fin=j), FakeEpic(date_fin_prevue=j))


def test_inv10_refuse_projet_hors_borne() -> None:
    refuse(
        "INV-10",
        check_project_dates_within_epic,
        FakeProject(date_fin=date(2027, 1, 1)),
        FakeEpic(date_fin_prevue=date(2026, 12, 31)),
    )


# --- INV-11 : Jalon.date ≤ Epic.jalon_fin_max (si défini) -------------------


def test_inv11_sans_contrainte_si_epic_sans_max() -> None:
    check_milestone_within_epic_max(
        FakeMilestone(date=date(2099, 1, 1)), FakeEpic(jalon_fin_max=None)
    )


def test_inv11_accepte_jalon_dans_la_borne() -> None:
    check_milestone_within_epic_max(
        FakeMilestone(date=date(2026, 8, 15)), FakeEpic(jalon_fin_max=date(2026, 12, 31))
    )


def test_inv11_accepte_egalite() -> None:
    j = date(2026, 12, 31)
    check_milestone_within_epic_max(FakeMilestone(date=j), FakeEpic(jalon_fin_max=j))


def test_inv11_refuse_jalon_hors_borne() -> None:
    refuse(
        "INV-11",
        check_milestone_within_epic_max,
        FakeMilestone(date=date(2027, 1, 1)),
        FakeEpic(jalon_fin_max=date(2026, 12, 31)),
    )


# --- INV-12 : Epic.date_fin_prévue ≤ jalon_fin_max (si les deux définis) ----


@pytest.mark.parametrize(
    "fin_prevue,jalon_max",
    [
        (None, None),
        (date(2026, 12, 31), None),
        (None, date(2026, 12, 31)),
    ],
    ids=["aucune", "sans_jalon_max", "sans_fin_prevue"],
)
def test_inv12_sans_contrainte_si_une_manque(
    fin_prevue: date | None, jalon_max: date | None
) -> None:
    check_epic_date_order(FakeEpic(date_fin_prevue=fin_prevue, jalon_fin_max=jalon_max))


def test_inv12_accepte_ordre_correct() -> None:
    check_epic_date_order(
        FakeEpic(date_fin_prevue=date(2026, 6, 30), jalon_fin_max=date(2026, 12, 31))
    )


def test_inv12_accepte_egalite() -> None:
    j = date(2026, 12, 31)
    check_epic_date_order(FakeEpic(date_fin_prevue=j, jalon_fin_max=j))


def test_inv12_refuse_ordre_inverse() -> None:
    refuse(
        "INV-12",
        check_epic_date_order,
        FakeEpic(date_fin_prevue=date(2027, 1, 1), jalon_fin_max=date(2026, 12, 31)),
    )


# --- INV-14 : le graphe des dépendances est un DAG --------------------------


def test_inv14_accepte_graphe_vide() -> None:
    check_dependency_acyclic([])


def test_inv14_accepte_chaine() -> None:
    check_dependency_acyclic([FakeDependency(1, 2), FakeDependency(2, 3)])


def test_inv14_accepte_diamant() -> None:
    """1→2, 1→3, 2→4, 3→4 : convergent mais acyclique."""
    check_dependency_acyclic(
        [FakeDependency(1, 2), FakeDependency(1, 3), FakeDependency(2, 4), FakeDependency(3, 4)]
    )


def test_inv14_accepte_composantes_disjointes() -> None:
    check_dependency_acyclic([FakeDependency(1, 2), FakeDependency(10, 11)])


def test_inv14_accepte_nouvelle_arete_sans_cycle() -> None:
    check_dependency_acyclic(
        [FakeDependency(1, 2), FakeDependency(2, 3)], new_edge=FakeDependency(1, 3)
    )


def test_inv14_refuse_cycle_cree_par_la_nouvelle_arete() -> None:
    refuse(
        "INV-14",
        check_dependency_acyclic,
        [FakeDependency(1, 2), FakeDependency(2, 3)],
        new_edge=FakeDependency(3, 1),
    )


def test_inv14_refuse_cycle_deja_present() -> None:
    refuse(
        "INV-14",
        check_dependency_acyclic,
        [FakeDependency(1, 2), FakeDependency(2, 1)],
    )


def test_inv14_refuse_cycle_long() -> None:
    aretes = [FakeDependency(i, i + 1) for i in range(1, 20)]
    refuse("INV-14", check_dependency_acyclic, aretes, new_edge=FakeDependency(20, 1))


def test_inv14_cycle_traverse_projets_et_epics() -> None:
    """SPEC INV-14 : « les dépendances peuvent traverser projets et epics ».

    Le check ne raisonne que sur des ids de tâches : la traversée est donc
    permise, et un cycle reste refusé quel que soit le projet d'origine.
    """
    check_dependency_acyclic([FakeDependency(1, 999)])
    refuse(
        "INV-14",
        check_dependency_acyclic,
        [FakeDependency(1, 999)],
        new_edge=FakeDependency(999, 1),
    )


# --- INV-15 : pas d'auto-dépendance -----------------------------------------


def test_inv15_accepte_deux_taches_distinctes() -> None:
    check_dependency_no_self(FakeDependency(1, 2))


def test_inv15_refuse_auto_dependance() -> None:
    refuse("INV-15", check_dependency_no_self, FakeDependency(7, 7))


# --- INV-18 : Projet réalisé ⇒ toutes ses tâches archivées ------------------


@pytest.mark.parametrize("statut", ["prevu", "en_cours", "abandonne"])
def test_inv18_sans_contrainte_hors_realise(statut: str) -> None:
    check_project_realise_consistency(
        FakeProject(statut=statut), [FakeTask(statut="ouvert")]
    )


def test_inv18_accepte_realise_sans_taches() -> None:
    check_project_realise_consistency(FakeProject(statut="realise"), [])


def test_inv18_accepte_realise_toutes_archivees() -> None:
    check_project_realise_consistency(
        FakeProject(statut="realise"),
        [FakeTask(id=1, statut="archive"), FakeTask(id=2, statut="archive")],
    )


def test_inv18_refuse_realise_avec_tache_ouverte() -> None:
    e = refuse(
        "INV-18",
        check_project_realise_consistency,
        FakeProject(nom="P", statut="realise"),
        [FakeTask(id=1, statut="archive"), FakeTask(id=2, nom="T2", statut="ouvert")],
    )
    assert "T2" in e.detail


# --- INV-19 : Epic réalisé ⇒ projets réalisés/abandonnés ET jalons atteints -


@pytest.mark.parametrize("statut", ["idee", "actif", "abandonne"])
def test_inv19_sans_contrainte_hors_realise(statut: str) -> None:
    check_epic_realise_consistency(
        FakeEpic(statut=statut), [FakeProject(statut="prevu")], [FakeMilestone(atteint=False)]
    )


def test_inv19_accepte_realise_vide() -> None:
    check_epic_realise_consistency(FakeEpic(statut="realise"), [], [])


def test_inv19_accepte_realise_coherent() -> None:
    check_epic_realise_consistency(
        FakeEpic(statut="realise"),
        [FakeProject(id=1, statut="realise"), FakeProject(id=2, statut="abandonne")],
        [FakeMilestone(atteint=True)],
    )


@pytest.mark.parametrize("statut_projet", ["prevu", "en_cours"])
def test_inv19_refuse_realise_avec_projet_non_termine(statut_projet: str) -> None:
    refuse(
        "INV-19",
        check_epic_realise_consistency,
        FakeEpic(statut="realise"),
        [FakeProject(statut=statut_projet)],
        [],
    )


def test_inv19_refuse_realise_avec_jalon_non_atteint() -> None:
    refuse(
        "INV-19",
        check_epic_realise_consistency,
        FakeEpic(statut="realise"),
        [FakeProject(statut="realise")],
        [FakeMilestone(atteint=False)],
    )


# --- INV-20 : unité cohérente entre les mesures d'un même Epic --------------


def test_inv20_accepte_premiere_mesure() -> None:
    check_measure_unit_consistency(FakeMeasure(unite="l/s"), [])


def test_inv20_accepte_meme_unite() -> None:
    check_measure_unit_consistency(
        FakeMeasure(unite="l/s"), [FakeMeasure(unite="l/s"), FakeMeasure(unite="l/s")]
    )


def test_inv20_unites_independantes_entre_epics() -> None:
    check_measure_unit_consistency(
        FakeMeasure(epic_trigramme="ABC", unite="l/s"),
        [FakeMeasure(epic_trigramme="XYZ", unite="kg")],
    )


def test_inv20_refuse_unite_incoherente() -> None:
    e = refuse(
        "INV-20",
        check_measure_unit_consistency,
        FakeMeasure(epic_trigramme="ABC", unite="kg"),
        [FakeMeasure(epic_trigramme="ABC", unite="l/s")],
    )
    assert "l/s" in e.detail and "kg" in e.detail


# --- INV-EQ-1a : Équipe.nom non vide après trim -----------------------------


@pytest.mark.parametrize("nom", ["Maintenance", " Maintenance ", "A"])
def test_inv_eq1a_accepte_nom_non_vide(nom: str) -> None:
    check_equipe_nom(nom)


@pytest.mark.parametrize("nom", ["", " ", "   ", "\t", "\n"])
def test_inv_eq1a_refuse_nom_vide_ou_blanc(nom: str) -> None:
    """Le cas "   " est précisément le défaut trouvé en 0.2 : Field(min_length=1)
    compte les caractères sans trim et l'acceptait."""
    refuse("INV-EQ-1a", check_equipe_nom, nom)


# --- INV-EQ-1b : Équipe.nom unique, insensible à la casse -------------------


def test_inv_eq1b_accepte_si_aucune_autre() -> None:
    check_equipe_nom_unique("Maintenance", [])


def test_inv_eq1b_accepte_noms_distincts() -> None:
    check_equipe_nom_unique("Maintenance", ["Production", "Qualité"])


@pytest.mark.parametrize(
    "existant", ["Maintenance", "MAINTENANCE", "maintenance", "  maintenance  "]
)
def test_inv_eq1b_refuse_doublon_insensible_a_la_casse(existant: str) -> None:
    refuse("INV-EQ-1b", check_equipe_nom_unique, "Maintenance", [existant])


# --- INV-EQ-2 : temps_dispo_hebdo ≥ 0 ---------------------------------------


@pytest.mark.parametrize("temps", [0, 0.0, 35, 35.5])
def test_inv_eq2_accepte_valeurs_positives(temps: float) -> None:
    check_equipe_temps_dispo(temps)


@pytest.mark.parametrize("temps", [-0.1, -1, -100])
def test_inv_eq2_refuse_valeurs_negatives(temps: float) -> None:
    refuse("INV-EQ-2", check_equipe_temps_dispo, temps)


# --- INV-EQ-3 : heures_allouées > 0 (strictement) ---------------------------


@pytest.mark.parametrize("heures", [0.5, 1, 35])
def test_inv_eq3_accepte_heures_positives(heures: float) -> None:
    check_allocation_heures(heures)


@pytest.mark.parametrize("heures", [0, 0.0, -1])
def test_inv_eq3_refuse_zero_ou_negatif(heures: float) -> None:
    """Zéro est refusé : une allocation à 0 h n'a pas de sens, on supprime."""
    refuse("INV-EQ-3", check_allocation_heures, heures)


# --- INV-EQ-4 : au plus une allocation par couple (tâche, équipe) -----------


def test_inv_eq4_accepte_si_aucune_allocation() -> None:
    check_allocation_unique(1, 1, [])


def test_inv_eq4_accepte_couples_distincts() -> None:
    check_allocation_unique(1, 2, [(1, 1), (2, 2)])


def test_inv_eq4_meme_equipe_sur_taches_differentes() -> None:
    check_allocation_unique(2, 1, [(1, 1)])


def test_inv_eq4_refuse_couple_deja_alloue() -> None:
    refuse("INV-EQ-4", check_allocation_unique, 1, 1, [(1, 1)])


# --- INV-EQ-5 : l'allocation référence une Tâche et une Équipe existantes ---


def test_inv_eq5_accepte_refs_existantes() -> None:
    check_allocation_refs(1, 1, tache_existe=True, equipe_existe=True)


def test_inv_eq5_refuse_tache_inconnue() -> None:
    e = refuse(
        "INV-EQ-5", check_allocation_refs, 999, 1, tache_existe=False, equipe_existe=True
    )
    assert "999" in e.detail


def test_inv_eq5_refuse_equipe_inconnue() -> None:
    e = refuse(
        "INV-EQ-5", check_allocation_refs, 1, 999, tache_existe=True, equipe_existe=False
    )
    assert "999" in e.detail
