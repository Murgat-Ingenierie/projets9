"""Phase 2 — garde-fou : tout code INV-X levé par le code doit être testé.

Le `README.md` pose la règle : « chaque ID `INV-X` donnera lieu à au moins un
test ». Une règle qu'aucun test ne fait respecter finit par ne plus être
respectée — c'est précisément ce qui est arrivé aux Équipes, arrivées avec 12
endpoints et zéro invariant nommé, sans que rien ne le signale.

Ce test échoue donc si quelqu'un ajoute un `InvariantError("INV-…")` sans écrire
le test qui va avec. Il ne juge pas la *qualité* du test — seulement qu'un test
cite le code. C'est un filet, pas une preuve.
"""

from __future__ import annotations

import pathlib
import re

API = pathlib.Path(__file__).resolve().parent.parent
CHECKS = API / "app" / "invariants" / "checks.py"
ROUTES = API / "app" / "routes"
TESTS = pathlib.Path(__file__).resolve().parent

# Les ID acceptent une minuscule finale : INV-EQ-1a / INV-EQ-1b sont scindés
# parce que leurs deux moitiés n'avaient pas le même statut (cf. docs/SPEC.md §3).
ID = r"INV-[A-Za-z0-9-]+"
# `InvariantError("INV-7", …)` dans la couche invariants
CODE_LEVE_RE = re.compile(rf'InvariantError\(\s*"({ID})"')
# `detail={"code": "INV-4", …}` en ligne dans les routes (INV-4, INV-5, INV-AUTH-1)
CODE_INLINE_RE = re.compile(rf'"code"\s*:\s*"({ID})"')


def codes_leves_par_le_code() -> set[str]:
    codes = set(CODE_LEVE_RE.findall(CHECKS.read_text(encoding="utf-8")))
    for f in ROUTES.glob("*.py"):
        codes |= set(CODE_INLINE_RE.findall(f.read_text(encoding="utf-8")))
    return codes


def codes_cites_par_les_tests() -> set[str]:
    cites: set[str] = set()
    for f in TESTS.glob("test_*.py"):
        if f.name == pathlib.Path(__file__).name:
            continue  # ne pas se compter soi-même
        contenu = f.read_text(encoding="utf-8")
        cites |= set(re.findall(rf'"({ID})"', contenu))
    return cites


def test_tout_code_invariant_leve_est_cite_par_un_test() -> None:
    leves = codes_leves_par_le_code()
    cites = codes_cites_par_les_tests()
    non_testes = sorted(leves - cites)
    assert not non_testes, (
        "Ces invariants sont levés par le code mais aucun test ne les cite : "
        f"{non_testes}. Règle du README : « chaque ID INV-X donnera lieu à au "
        "moins un test »."
    )


def test_aucun_test_ne_cite_un_code_inexistant() -> None:
    """Le sens inverse : un test qui attend un code que plus personne ne lève est
    un test qui ne peut plus rien attraper. C'est ce qui est arrivé à
    `check_task_advancement_status`, disparu du code mais toujours importé par
    les tests — et la CI ne l'a jamais dit, elle échouait déjà au lint."""
    leves = codes_leves_par_le_code()
    cites = codes_cites_par_les_tests()
    # Retirés de la SPEC : ils n'ont plus de fonction, et des tests vérifient
    # justement que la mutation est désormais ACCEPTÉE. Les citer est légitime.
    retires = {"INV-9", "INV-13", "INV-16", "INV-17"}
    fantomes = sorted(cites - leves - retires)
    assert not fantomes, (
        f"Ces codes sont attendus par des tests mais plus levés nulle part : {fantomes}. "
        "Soit l'invariant a été retiré (le documenter dans docs/SPEC.md et l'ajouter "
        "à `retires` ci-dessus), soit son câblage a sauté."
    )


def test_la_liste_des_invariants_couverts_est_celle_attendue() -> None:
    """Recense explicitement ce qui est couvert. Ce test échoue quand un
    invariant apparaît ou disparaît — il force à mettre à jour docs/SPEC.md
    en même temps que le code, plutôt que six semaines plus tard."""
    attendus = {
        "INV-1", "INV-2", "INV-3", "INV-4", "INV-5", "INV-6", "INV-7", "INV-8",
        "INV-10", "INV-11", "INV-12", "INV-14", "INV-15", "INV-18", "INV-19",
        "INV-20",
        "INV-AUTH-1", "INV-AUTH-2", "INV-AUTH-3",
        "INV-EQ-1a", "INV-EQ-1b", "INV-EQ-2", "INV-EQ-3", "INV-EQ-4", "INV-EQ-5",
    }
    leves = codes_leves_par_le_code()
    assert leves == attendus, (
        f"En trop : {sorted(leves - attendus)} — manquants : {sorted(attendus - leves)}. "
        "Si c'est voulu, mettre à jour docs/SPEC.md §3 ET cette liste."
    )
