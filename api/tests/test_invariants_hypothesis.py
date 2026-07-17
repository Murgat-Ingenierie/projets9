"""Phase 2 — tests générateurs (Hypothesis).

Troisième couche prévue par le `README.md` : « couvrir des combinaisons larges ».

L'unitaire vérifie des cas choisis à la main — donc les cas auxquels on a pensé.
Ces tests-ci cherchent ceux auxquels on n'a pas pensé, en exprimant chaque
invariant comme une **propriété** vraie pour toute entrée.

Le morceau central est INV-14 : la détection de cycle est un DFS tricolore écrit
à la main, exactement le genre de code où se logent les bugs subtils. On la
confronte à un **oracle indépendant** (algorithme de Kahn, une tout autre
mécanique) et on exige que les deux soient toujours d'accord. Deux
implémentations distinctes qui divergent sur un graphe = un bug chez l'une des
deux ; Hypothesis réduit alors le contre-exemple au plus petit graphe fautif.
"""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.invariants import (
    InvariantError,
    check_dependency_acyclic,
    check_dependency_no_self,
    check_epic_trigramme,
    check_equipe_nom,
    check_equipe_nom_unique,
    check_equipe_temps_dispo,
    check_max_active_users,
    check_project_dates,
    check_task_dates,
)

TRIGRAMME_RE = re.compile(r"^[A-Z0-9]{3}$")


@dataclass
class Dep:
    tache_amont_id: int
    tache_aval_id: int
    type: str = "FS"


@dataclass
class Tache:
    date_debut: date
    date_fin: date
    id: int = 1
    nom: str = "T"
    projet_id: int = 1
    statut: str = "ouvert"


@dataclass
class Projet:
    date_debut: date
    date_fin: date
    id: int = 1
    nom: str = "P"
    epic_trigramme: str = "ABC"
    statut: str = "prevu"


def a_un_cycle_kahn(aretes: list[tuple[int, int]]) -> bool:
    """Oracle indépendant : tri topologique de Kahn.

    Retire itérativement les nœuds de degré entrant nul. S'il reste des nœuds,
    c'est qu'ils sont pris dans un cycle. Mécanique volontairement différente du
    DFS tricolore de `check_dependency_acyclic`, pour que les deux ne partagent
    pas un éventuel bug commun. Gère les boucles sur soi : un nœud avec une
    arête vers lui-même n'atteint jamais un degré entrant nul.
    """
    noeuds = {n for a in aretes for n in a}
    sortants: dict[int, list[int]] = defaultdict(list)
    degre_entrant: dict[int, int] = dict.fromkeys(noeuds, 0)
    for amont, aval in aretes:
        sortants[amont].append(aval)
        degre_entrant[aval] += 1

    file = [n for n in noeuds if degre_entrant[n] == 0]
    vus = 0
    while file:
        n = file.pop()
        vus += 1
        for suivant in sortants[n]:
            degre_entrant[suivant] -= 1
            if degre_entrant[suivant] == 0:
                file.append(suivant)
    return vus != len(noeuds)


def leve(fn, *args, **kwargs) -> bool:
    try:
        fn(*args, **kwargs)
        return False
    except InvariantError:
        return True


# --- INV-14 : le DFS tricolore doit toujours être d'accord avec Kahn --------

aretes_st = st.lists(
    st.tuples(st.integers(min_value=1, max_value=8), st.integers(min_value=1, max_value=8)),
    max_size=25,
)


@settings(max_examples=400)
@given(aretes=aretes_st)
def test_inv14_accord_avec_oracle_de_kahn(aretes: list[tuple[int, int]]) -> None:
    deps = [Dep(a, b) for a, b in aretes]
    assert leve(check_dependency_acyclic, deps) == a_un_cycle_kahn(aretes)


@settings(max_examples=300)
@given(aretes=aretes_st, nouvelle=st.tuples(st.integers(1, 8), st.integers(1, 8)))
def test_inv14_accord_avec_oracle_a_l_ajout_d_une_arete(
    aretes: list[tuple[int, int]], nouvelle: tuple[int, int]
) -> None:
    """Le chemin réellement emprunté par la route : accepter une arête ssi elle
    ne referme pas un cycle."""
    deps = [Dep(a, b) for a, b in aretes]
    attendu = a_un_cycle_kahn([*aretes, nouvelle])
    assert leve(check_dependency_acyclic, deps, new_edge=Dep(*nouvelle)) == attendu


@settings(max_examples=200)
@given(
    noeuds=st.lists(st.integers(min_value=1, max_value=30), min_size=2, max_size=12, unique=True)
)
def test_inv14_une_chaine_stricte_est_toujours_acyclique(noeuds: list[int]) -> None:
    """Propriété : n'importe quelle chaîne n1→n2→…→nk sur des nœuds distincts est
    un DAG, quels que soient les identifiants."""
    aretes = [Dep(noeuds[i], noeuds[i + 1]) for i in range(len(noeuds) - 1)]
    check_dependency_acyclic(aretes)


@settings(max_examples=200)
@given(
    noeuds=st.lists(st.integers(min_value=1, max_value=30), min_size=2, max_size=10, unique=True)
)
def test_inv14_boucler_une_chaine_cree_toujours_un_cycle(noeuds: list[int]) -> None:
    """Propriété duale : refermer la chaîne crée toujours un cycle."""
    aretes = [Dep(noeuds[i], noeuds[i + 1]) for i in range(len(noeuds) - 1)]
    with pytest.raises(InvariantError) as exc:
        check_dependency_acyclic(aretes, new_edge=Dep(noeuds[-1], noeuds[0]))
    assert exc.value.code == "INV-14"


# --- INV-15 : auto-dépendance ----------------------------------------------


@given(a=st.integers(), b=st.integers())
def test_inv15_leve_exactement_quand_les_ids_sont_egaux(a: int, b: int) -> None:
    assert leve(check_dependency_no_self, Dep(a, b)) == (a == b)


# --- INV-1 : trigramme ------------------------------------------------------


@given(t=st.text(alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", min_size=3, max_size=3))
def test_inv1_accepte_tout_trigramme_conforme(t: str) -> None:
    check_epic_trigramme(t)


@settings(max_examples=400)
@given(t=st.text(max_size=6))
def test_inv1_leve_exactement_quand_le_motif_ne_colle_pas(t: str) -> None:
    """Propriété : accepté ⇔ conforme à ^[A-Z0-9]{3}$, sur du texte quelconque
    (accents, espaces, caractères de contrôle, vide…)."""
    assert leve(check_epic_trigramme, t) == (TRIGRAMME_RE.match(t) is None)


# --- INV-7 / INV-8 : ordre des dates, comparaison inclusive -----------------


@given(d1=st.dates(), d2=st.dates())
def test_inv7_leve_exactement_quand_debut_apres_fin(d1: date, d2: date) -> None:
    assert leve(check_task_dates, Tache(date_debut=d1, date_fin=d2)) == (d1 > d2)


@given(d1=st.dates(), d2=st.dates())
def test_inv8_leve_exactement_quand_debut_apres_fin(d1: date, d2: date) -> None:
    assert leve(check_project_dates, Projet(date_debut=d1, date_fin=d2)) == (d1 > d2)


@given(d=st.dates())
def test_inv7_un_jour_unique_est_toujours_valide(d: date) -> None:
    """SPEC §3 : « toutes les comparaisons sont inclusives »."""
    check_task_dates(Tache(date_debut=d, date_fin=d))


# --- INV-AUTH-2 : plafond d'utilisateurs actifs -----------------------------


@given(n=st.integers(min_value=0, max_value=200), limite=st.integers(min_value=1, max_value=50))
def test_inv_auth2_leve_exactement_au_dela_de_la_limite(n: int, limite: int) -> None:
    assert leve(check_max_active_users, n, limit=limite) == (n > limite)


# --- INV-EQ-1a / INV-EQ-1b / INV-EQ-2 ---------------------------------------


@settings(max_examples=300)
@given(nom=st.text(max_size=10))
def test_inv_eq1a_leve_exactement_quand_le_nom_est_blanc(nom: str) -> None:
    """Propriété : refusé ⇔ vide après trim. Couvre les blancs Unicode que
    `Field(min_length=1)` laisse passer."""
    assert leve(check_equipe_nom, nom) == (not nom.strip())


@settings(max_examples=300)
@given(
    nom=st.text(min_size=1, max_size=6),
    autres=st.lists(st.text(min_size=1, max_size=6), max_size=6),
)
def test_inv_eq1b_leve_exactement_sur_collision_normalisee(
    nom: str, autres: list[str]
) -> None:
    attendu = any(a.strip().lower() == nom.strip().lower() for a in autres)
    assert leve(check_equipe_nom_unique, nom, autres) == attendu


@given(temps=st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False))
def test_inv_eq2_leve_exactement_sous_zero(temps: float) -> None:
    assert leve(check_equipe_temps_dispo, temps) == (temps < 0)
