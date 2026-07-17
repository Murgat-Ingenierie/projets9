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
    statut: str


class MilestoneLike(Protocol):
    nom: str
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


def check_milestone_has_projects(project_ids: list[int]) -> None:
    """INV-6 : un jalon doit être rattaché à au moins un projet (relation N-N).

    Évolution de l'invariant depuis la migration 0008 : le rattachement passe
    de N-N avec les epics à N-N avec les projets (plus précis).
    """
    if not project_ids:
        raise InvariantError(
            "INV-6",
            "Jalon doit être rattaché à au moins un projet",
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
# INV-10 / INV-11 / INV-12 — cascade
#
# INV-9 retiré (cf. docs/SPEC.md) : une tâche peut sortir de la fenêtre de son
# projet. Le planning Gantt la signale par une hachure rouge, l'API ne refuse
# plus la mutation.
# -----------------------------------------------------------------------------


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
    """INV-11 : jalon rattaché à un Epic respecte son jalon_fin_max si défini.

    À appeler une fois par epic auquel le jalon est rattaché.
    """
    if e.jalon_fin_max is not None and m.date > e.jalon_fin_max:
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
# INV-14 / INV-15 — graphe
#
# INV-13 retiré (cf. docs/SPEC.md) : plus aucune contrainte de dates entre
# tâches dépendantes. Une dépendance se crée librement, indépendamment de
# l'ordre chronologique.
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
# INV-16 — supprimé : le champ avancement a été retiré (migration 0007).
# INV-17 — supprimé : le statut tâche est désormais ouvert/archive directement.
# -----------------------------------------------------------------------------


# -----------------------------------------------------------------------------
# INV-18 / INV-19 — réalisation projet / epic
# -----------------------------------------------------------------------------


def check_project_realise_consistency(p: ProjectLike, tasks: Iterable[TaskLike]) -> None:
    """INV-18 : projet realise ⇒ toutes ses tâches archive."""
    if p.statut != "realise":
        return
    for t in tasks:
        if t.statut != "archive":
            raise InvariantError(
                "INV-18",
                f"Projet {p.nom!r} marqué réalisé alors que la tâche {t.nom!r} est encore ouverte",
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


# -----------------------------------------------------------------------------
# INV-EQ-1a / INV-EQ-1b / INV-EQ-2 — Équipe
# INV-EQ-3 / INV-EQ-4 / INV-EQ-5 — allocation TâcheÉquipe
#
# Comme pour INV-1, certaines de ces règles sont aussi portées par le schéma
# Pydantic, qui rejette en 422 avant que la route ne s'exécute. Les fonctions
# ci-dessous restent la définition testable de l'invariant, indépendamment de
# la couche qui l'applique en premier.
# -----------------------------------------------------------------------------


def check_equipe_nom(nom: str) -> None:
    """INV-EQ-1a : Équipe.nom non vide après trim.

    Non couvert par `Field(min_length=1)`, qui compte les caractères sans
    trim et accepte donc "   ".
    """
    if not (nom or "").strip():
        raise InvariantError("INV-EQ-1a", "Nom d'équipe vide")


def check_equipe_nom_unique(nom: str, autres_noms: Iterable[str]) -> None:
    """INV-EQ-1b : Équipe.nom unique, insensible à la casse.

    `autres_noms` = les noms des *autres* équipes (l'appelant exclut l'équipe
    en cours de modification, sinon un renommage à casse égale échouerait).
    """
    cible = (nom or "").strip().lower()
    for autre in autres_noms:
        if (autre or "").strip().lower() == cible:
            raise InvariantError("INV-EQ-1b", f"Nom d'équipe déjà utilisé : {nom!r}")


def check_equipe_temps_dispo(temps_dispo_hebdo: float) -> None:
    """INV-EQ-2 : Équipe.temps_dispo_hebdo ≥ 0."""
    if temps_dispo_hebdo < 0:
        raise InvariantError(
            "INV-EQ-2", f"temps_dispo_hebdo négatif : {temps_dispo_hebdo}"
        )


def check_allocation_heures(heures_allouees: float) -> None:
    """INV-EQ-3 : TâcheÉquipe.heures_allouées > 0."""
    if heures_allouees <= 0:
        raise InvariantError(
            "INV-EQ-3", f"heures_allouées doit être > 0 (reçu {heures_allouees})"
        )


def check_allocation_unique(
    tache_id: int, equipe_id: int, couples_existants: Iterable[tuple[int, int]]
) -> None:
    """INV-EQ-4 : au plus une allocation par couple (tâche, équipe)."""
    if (tache_id, equipe_id) in set(couples_existants):
        raise InvariantError(
            "INV-EQ-4",
            f"Équipe {equipe_id} déjà allouée sur la tâche {tache_id}",
        )


def check_allocation_refs(
    tache_id: int, equipe_id: int, *, tache_existe: bool, equipe_existe: bool
) -> None:
    """INV-EQ-5 : l'allocation référence une Tâche et une Équipe existantes."""
    if not tache_existe:
        raise InvariantError("INV-EQ-5", f"Tâche {tache_id} inconnue")
    if not equipe_existe:
        raise InvariantError("INV-EQ-5", f"Équipe {equipe_id} inconnue")
