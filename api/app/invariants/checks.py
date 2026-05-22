"""Invariants métier du gestionnaire de projet.

Chaque fonction implémente UN invariant identifié dans `docs/SPEC.md`.
L'ID `INV-X` est rappelé dans la docstring et dans le code de l'erreur levée.
La phase 2 (tests auto) référencera ces IDs depuis pytest/Hypothesis.

Convention :
- Chaque check lève `InvariantError(code="INV-X", detail="...")` en cas d'échec.
- Les checks sont sans état et purement déductifs : ils prennent les données
  en argument (objets ou listes), pas de session DB cachée.
- Les checks qui ont besoin de l'état global (ex. unicité, DAG, max users)
  reçoivent la liste/contexte nécessaire en paramètre.
"""

from __future__ import annotations

import re
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from typing import Protocol


class InvariantError(Exception):
    """Levée quand une mutation violerait un invariant."""

    def __init__(self, code: str, detail: str):
        self.code = code
        self.detail = detail
        super().__init__(f"[{code}] {detail}")


def _fr(d: date) -> str:
    return d.strftime("%d/%m/%Y")


# -----------------------------------------------------------------------------
# Protocols : décrivent le minimum attendu de chaque entité pour le check.
# Ça permet aux tests de passer des objets simples (dataclasses) sans charger
# SQLAlchemy.
# -----------------------------------------------------------------------------


class HasDateRange(Protocol):
    date_debut: date
    date_fin: date


class EpicLike(Protocol):
    trigramme: str
    nom: str
    statut: str
    critere_reussite: str | None
    date_fin_prevue: date | None
    jalon_fin_max: date | None


class ProjectLike(Protocol):
    id: int
    nom: str
    epic_trigramme: str
    date_debut: date
    date_fin: date
    statut: str


class TaskLike(Protocol):
    id: int
    nom: str
    projet_id: int
    date_debut: date
    date_fin: date
    avancement: int
    statut: str


class MilestoneLike(Protocol):
    epic_trigramme: str | None
    project_id: int | None
    date: date
    atteint: bool


class DependencyLike(Protocol):
    tache_amont_id: int
    tache_aval_id: int
    type: str


class UserLike(Protocol):
    id: int
    role: str
    actif: bool


class MeasureLike(Protocol):
    epic_trigramme: str
    unite: str


# -----------------------------------------------------------------------------
# INV-1 / INV-2 / INV-3 — Epic
# -----------------------------------------------------------------------------

_TRIGRAMME_RE = re.compile(r"^[A-Z0-9]{3}$")


def check_epic_trigramme(trigramme: str) -> None:
    """INV-1 : trigramme = 3 caractères [A-Z0-9]."""
    if not _TRIGRAMME_RE.match(trigramme or ""):
        raise InvariantError("INV-1", f"trigramme invalide: {trigramme!r}")


def check_epic_basics(epic: EpicLike) -> None:
    """INV-2 : nom non vide. INV-3 : si actif, critère_réussite non vide."""
    if not epic.nom or not epic.nom.strip():
        raise InvariantError("INV-2", "Epic.nom est vide")
    if epic.statut == "actif" and not (epic.critere_reussite or "").strip():
        raise InvariantError(
            "INV-3", "Epic actif sans critère_réussite"
        )


# -----------------------------------------------------------------------------
# INV-AUTH-1, INV-AUTH-2, INV-AUTH-3
# -----------------------------------------------------------------------------


def check_max_active_users(active_count: int, limit: int = 10) -> None:
    """INV-AUTH-2 : au plus N users actifs."""
    if active_count > limit:
        raise InvariantError(
            "INV-AUTH-2", f"{active_count} users actifs > limite {limit}"
        )


def check_min_one_admin(users_after: Iterable[UserLike]) -> None:
    """INV-AUTH-3 : au moins un admin actif après la mutation."""
    admins = [u for u in users_after if u.actif and u.role == "admin"]
    if not admins:
        raise InvariantError(
            "INV-AUTH-3", "Aucun admin actif après la mutation"
        )


# -----------------------------------------------------------------------------
# INV-6 — Jalon XOR parent
# -----------------------------------------------------------------------------


def check_milestone_xor_parent(m: MilestoneLike) -> None:
    """INV-6 : exactement un de (epic_trigramme, project_id) est défini."""
    has_epic = m.epic_trigramme is not None
    has_project = m.project_id is not None
    if has_epic == has_project:
        raise InvariantError(
            "INV-6",
            "Jalon doit avoir epic_trigramme XOR project_id (exactement un)",
        )


# -----------------------------------------------------------------------------
# INV-7 / INV-8 — dates internes
# -----------------------------------------------------------------------------


def check_task_dates(t: TaskLike) -> None:
    """INV-7 : task.date_début ≤ task.date_fin."""
    if t.date_debut > t.date_fin:
        raise InvariantError(
            "INV-7",
            f"Tâche {t.nom!r} : date de début ({_fr(t.date_debut)}) après date de fin ({_fr(t.date_fin)})",
        )


def check_project_dates(p: ProjectLike) -> None:
    """INV-8 : project.date_début ≤ project.date_fin."""
    if p.date_debut > p.date_fin:
        raise InvariantError(
            "INV-8",
            f"Projet {p.nom!r} : date de début ({_fr(p.date_debut)}) après date de fin ({_fr(p.date_fin)})",
        )


# -----------------------------------------------------------------------------
# INV-9 / INV-10 / INV-11 / INV-12 — cascade
# -----------------------------------------------------------------------------


def check_task_dates_within_project(t: TaskLike, p: ProjectLike) -> None:
    """INV-9 : [task.date_début, task.date_fin] ⊆ [project.date_début, project.date_fin]."""
    if t.date_debut < p.date_debut or t.date_fin > p.date_fin:
        raise InvariantError(
            "INV-9",
            (
                f"Tâche {t.nom!r} ({_fr(t.date_debut)} → {_fr(t.date_fin)}) "
                f"hors de la fenêtre du projet {p.nom!r} "
                f"({_fr(p.date_debut)} → {_fr(p.date_fin)})"
            ),
        )


def check_project_dates_within_epic(p: ProjectLike, e: EpicLike) -> None:
    """INV-10 : project.date_fin ≤ epic.date_fin_prévue (si définie)."""
    if e.date_fin_prevue is not None and p.date_fin > e.date_fin_prevue:
        raise InvariantError(
            "INV-10",
            (
                f"Projet {p.nom!r} se termine le {_fr(p.date_fin)} "
                f"après la date de fin prévue de l'epic {e.trigramme} ({_fr(e.date_fin_prevue)})"
            ),
        )


def check_milestone_within_epic_max(m: MilestoneLike, e: EpicLike) -> None:
    """INV-11 : jalon d'Epic respecte jalon_fin_max si défini."""
    if (
        m.epic_trigramme is not None
        and e.jalon_fin_max is not None
        and m.date > e.jalon_fin_max
    ):
        raise InvariantError(
            "INV-11",
            (
                f"Jalon {m.nom!r} prévu le {_fr(m.date)} "
                f"après le jalon de fin maximum de l'epic {e.trigramme} ({_fr(e.jalon_fin_max)})"
            ),
        )


def check_epic_date_order(e: EpicLike) -> None:
    """INV-12 : date_fin_prévue ≤ jalon_fin_max si les deux sont définis."""
    if (
        e.date_fin_prevue is not None
        and e.jalon_fin_max is not None
        and e.date_fin_prevue > e.jalon_fin_max
    ):
        raise InvariantError(
            "INV-12",
            (
                f"Epic {e.trigramme} : date de fin prévue ({_fr(e.date_fin_prevue)}) "
                f"après jalon de fin maximum ({_fr(e.jalon_fin_max)})"
            ),
        )


# -----------------------------------------------------------------------------
# INV-13 — dépendances et dates
# -----------------------------------------------------------------------------


def check_dependency_dates(dep: DependencyLike, amont: TaskLike, aval: TaskLike) -> None:
    """INV-13 : règle FS/SS/FF entre amont et aval."""
    if dep.type == "FS":
        if amont.date_fin > aval.date_debut:
            raise InvariantError(
                "INV-13",
                (
                    f"Dépendance Fin → Début : {amont.nom!r} se termine le {_fr(amont.date_fin)} "
                    f"après le début de {aval.nom!r} ({_fr(aval.date_debut)})"
                ),
            )
    elif dep.type == "SS":
        if amont.date_debut > aval.date_debut:
            raise InvariantError(
                "INV-13",
                (
                    f"Dépendance Début → Début : {amont.nom!r} commence le {_fr(amont.date_debut)} "
                    f"après le début de {aval.nom!r} ({_fr(aval.date_debut)})"
                ),
            )
    elif dep.type == "FF":
        if amont.date_fin > aval.date_fin:
            raise InvariantError(
                "INV-13",
                (
                    f"Dépendance Fin → Fin : {amont.nom!r} se termine le {_fr(amont.date_fin)} "
                    f"après la fin de {aval.nom!r} ({_fr(aval.date_fin)})"
                ),
            )
    else:
        raise InvariantError("INV-13", f"Type de dépendance inconnu : {dep.type}")


# -----------------------------------------------------------------------------
# INV-14 / INV-15 — graphe
# -----------------------------------------------------------------------------


def check_dependency_no_self(dep: DependencyLike) -> None:
    """INV-15 : pas d'auto-dépendance."""
    if dep.tache_amont_id == dep.tache_aval_id:
        raise InvariantError("INV-15", "Auto-dépendance interdite")


@dataclass
class _Edge:
    amont: int
    aval: int


def check_dependency_acyclic(
    existing: Iterable[DependencyLike], new_edge: DependencyLike | None = None
) -> None:
    """INV-14 : le graphe des dépendances reste un DAG après ajout de `new_edge`.

    Si `new_edge` est None, on vérifie juste les arêtes existantes.
    """
    edges: list[_Edge] = [_Edge(d.tache_amont_id, d.tache_aval_id) for d in existing]
    if new_edge is not None:
        edges.append(_Edge(new_edge.tache_amont_id, new_edge.tache_aval_id))

    adj: dict[int, list[int]] = defaultdict(list)
    nodes: set[int] = set()
    for e in edges:
        adj[e.amont].append(e.aval)
        nodes.add(e.amont)
        nodes.add(e.aval)

    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[int, int] = {n: WHITE for n in nodes}

    def dfs(u: int) -> None:
        color[u] = GRAY
        for v in adj.get(u, ()):
            if color[v] == GRAY:
                raise InvariantError(
                    "INV-14", f"Cycle détecté impliquant les tâches {u} et {v}"
                )
            if color[v] == WHITE:
                dfs(v)
        color[u] = BLACK

    for n in nodes:
        if color[n] == WHITE:
            dfs(n)


# -----------------------------------------------------------------------------
# INV-16 / INV-17 — avancement & statut tâche
# -----------------------------------------------------------------------------


def check_task_advancement_status(t: TaskLike) -> None:
    """INV-16 : avancement ∈ [0, 100]. INV-17 : statut=realise ⇔ avancement=100."""
    if not (0 <= t.avancement <= 100):
        raise InvariantError(
            "INV-16", f"Task {t.id}: avancement={t.avancement} hors [0,100]"
        )
    is_realise = t.statut == "realise"
    is_complete = t.avancement == 100
    if is_realise != is_complete:
        raise InvariantError(
            "INV-17",
            f"Task {t.id}: statut={t.statut!r} et avancement={t.avancement} incohérents",
        )


# -----------------------------------------------------------------------------
# INV-18 / INV-19 — réalisation projet / epic
# -----------------------------------------------------------------------------


def check_project_realise_consistency(p: ProjectLike, tasks: Iterable[TaskLike]) -> None:
    """INV-18 : projet realise ⇒ toutes ses tâches realise/abandonne."""
    if p.statut != "realise":
        return
    for t in tasks:
        if t.statut not in ("realise", "abandonne"):
            raise InvariantError(
                "INV-18",
                f"Project {p.id} realise mais task {t.id} en statut {t.statut!r}",
            )


def check_epic_realise_consistency(
    e: EpicLike,
    projects: Iterable[ProjectLike],
    milestones: Iterable[MilestoneLike],
) -> None:
    """INV-19 : epic realise ⇒ tous ses projets realise/abandonne ET tous ses jalons atteints."""
    if e.statut != "realise":
        return
    for p in projects:
        if p.statut not in ("realise", "abandonne"):
            raise InvariantError(
                "INV-19",
                f"Epic {e.trigramme} realise mais project {p.id} en statut {p.statut!r}",
            )
    for m in milestones:
        if not m.atteint:
            raise InvariantError(
                "INV-19",
                f"Epic {e.trigramme} realise mais jalon non atteint",
            )


# -----------------------------------------------------------------------------
# INV-20 — mesures cohérentes en unité
# -----------------------------------------------------------------------------


def check_measure_unit_consistency(
    new_measure: MeasureLike, existing: Iterable[MeasureLike]
) -> None:
    """INV-20 : toutes les mesures d'un même Epic partagent la même unité."""
    for m in existing:
        if m.epic_trigramme == new_measure.epic_trigramme and m.unite != new_measure.unite:
            raise InvariantError(
                "INV-20",
                f"Mesure: unité {new_measure.unite!r} incohérente avec {m.unite!r} sur Epic {m.epic_trigramme}",
            )
