"""Garde INV-6 sur les suppressions en cascade.

Supprimer un projet — ou un epic, qui cascade sur tous ses projets — retire des
lignes `milestone_project`. Un jalon dont **tous** les projets disparaissent se
retrouverait sans rattachement : état interdit par INV-6, et qui plus est
inéditable (toute mise à jour est ensuite refusée tant qu'aucun projet n'est
fourni). On refuse donc la suppression en amont, avec un message actionnable —
conformément au principe de la SPEC : l'API bloque l'incohérence structurelle.
"""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.milestone import Milestone, milestone_project


def refuser_si_jalons_orphelins(db: Session, project_ids: set[int]) -> None:
    """Refuse (409 INV-6) si retirer `project_ids` orphelinerait un jalon.

    Un jalon est concerné si l'ensemble de ses projets est inclus dans
    `project_ids` — donc si tous ses rattachements sont sur le point de partir.
    """
    if not project_ids:
        return
    candidats = (
        db.execute(
            select(Milestone)
            .join(milestone_project, milestone_project.c.milestone_id == Milestone.id)
            .where(milestone_project.c.project_id.in_(project_ids))
        )
        .scalars()
        .unique()
        .all()
    )
    orphelins = [m for m in candidats if set(m.project_ids) <= project_ids]
    if orphelins:
        noms = ", ".join(repr(m.nom) for m in orphelins)
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "code": "INV-6",
                "message": (
                    f"Suppression impossible : le(s) jalon(s) {noms} ne seraient "
                    "plus rattachés à aucun projet. Rattachez-les à un autre projet "
                    "ou supprimez-les d'abord."
                ),
            },
        )
