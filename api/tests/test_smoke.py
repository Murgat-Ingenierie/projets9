"""Tests smoke v0 — phase 2 ajoutera les tests d'invariants complets."""

from app.invariants import InvariantError, check_dependency_acyclic


def test_imports_ok() -> None:
    """Vérifie que les modules s'importent (CI ne casse pas avant phase 2)."""
    from app.invariants import (  # noqa: F401
        check_epic_realise_consistency,
        check_task_advancement_status,
    )


def test_acyclic_simple() -> None:
    """Place-holder pour montrer la convention : un test cite l'INV qu'il couvre."""

    class D:
        def __init__(self, a: int, b: int) -> None:
            self.tache_amont_id = a
            self.tache_aval_id = b
            self.type = "FS"

    # INV-14 : pas de cycle → pas d'erreur
    check_dependency_acyclic([D(1, 2), D(2, 3)])

    # INV-14 : cycle → erreur attendue
    try:
        check_dependency_acyclic([D(1, 2), D(2, 3)], new_edge=D(3, 1))
    except InvariantError as e:
        assert e.code == "INV-14"
    else:
        raise AssertionError("InvariantError attendue (INV-14)")
