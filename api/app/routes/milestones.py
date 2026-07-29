from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_admin
from app.database import get_db
from app.invariants import InvariantError
from app.invariants.checks import (
    check_milestone_has_projects,
    check_milestone_within_epic_max,
)
from app.models.epic import Epic
from app.models.milestone import Milestone
from app.models.project import Project
from app.models.user import User
from app.routes.errors import http_from_invariant
from app.schemas.milestone import MilestoneCreate, MilestoneRead, MilestoneUpdate

router = APIRouter(prefix="/api/milestones", tags=["milestones"])


def _resolve_projects(db: Session, project_ids: list[int]) -> list[Project]:
    projs: list[Project] = []
    for pid in project_ids:
        p = db.get(Project, pid)
        if p is None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail={"code": "INV-6", "message": f"Projet {pid} inconnu"},
            )
        projs.append(p)
    return projs


def _validate(m: Milestone, db: Session) -> None:
    try:
        check_milestone_has_projects([p.id for p in m.projects])
        # On vérifie le jalon_fin_max pour chaque epic des projets rattachés.
        seen_epic_tris: set[str] = set()
        for p in m.projects:
            if p.epic_trigramme in seen_epic_tris:
                continue
            seen_epic_tris.add(p.epic_trigramme)
            epic = db.get(Epic, p.epic_trigramme)
            if epic is not None:
                check_milestone_within_epic_max(m, epic)
    except InvariantError as e:
        raise http_from_invariant(e) from None


@router.get("", response_model=list[MilestoneRead])
def list_milestones(
    project_id: int | None = None,
    epic: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> list[Milestone]:
    q = select(Milestone).order_by(Milestone.date)
    if project_id is not None:
        q = q.join(Milestone.projects).where(Project.id == project_id)
    elif epic:
        q = q.join(Milestone.projects).where(Project.epic_trigramme == epic.upper())
    return list(db.execute(q).scalars().unique().all())


@router.post("", response_model=MilestoneRead, status_code=status.HTTP_201_CREATED)
def create_milestone(
    payload: MilestoneCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> Milestone:
    projs = _resolve_projects(db, payload.project_ids)
    m = Milestone(
        nom=payload.nom,
        date=payload.date,
        atteint=payload.atteint,
        updated_by_id=me.id,
    )
    m.projects = projs
    _validate(m, db)
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.put("/{milestone_id}", response_model=MilestoneRead)
def update_milestone(
    milestone_id: int,
    payload: MilestoneUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> Milestone:
    m = db.get(Milestone, milestone_id)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Milestone introuvable")
    data = payload.model_dump(exclude_unset=True)
    if "nom" in data:
        m.nom = data["nom"]
    if "date" in data:
        m.date = data["date"]
    if "atteint" in data:
        m.atteint = data["atteint"]
    if "project_ids" in data:
        m.projects = _resolve_projects(db, data["project_ids"])
    m.updated_by_id = me.id
    _validate(m, db)
    db.commit()
    db.refresh(m)
    return m


@router.delete("/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_milestone(
    milestone_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
) -> None:
    m = db.get(Milestone, milestone_id)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Milestone introuvable")
    db.delete(m)
    db.commit()
