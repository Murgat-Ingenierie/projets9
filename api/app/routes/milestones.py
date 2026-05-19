from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.invariants import InvariantError
from app.invariants.checks import (
    check_milestone_within_epic_max,
    check_milestone_xor_parent,
)
from app.models.epic import Epic
from app.models.milestone import Milestone
from app.models.project import Project
from app.models.user import User
from app.routes.errors import http_from_invariant
from app.schemas.milestone import MilestoneCreate, MilestoneRead, MilestoneUpdate

router = APIRouter(prefix="/api/milestones", tags=["milestones"])


def _validate(m: Milestone, db: Session) -> None:
    try:
        check_milestone_xor_parent(m)
        if m.epic_trigramme is not None:
            epic = db.get(Epic, m.epic_trigramme)
            if epic is None:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    detail={
                        "code": "INV-6",
                        "message": f"Epic {m.epic_trigramme} inconnu",
                    },
                )
            check_milestone_within_epic_max(m, epic)
        else:
            project = db.get(Project, m.project_id)
            if project is None:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    detail={"code": "INV-6", "message": f"Projet {m.project_id} inconnu"},
                )
    except InvariantError as e:
        raise http_from_invariant(e) from None


@router.get("", response_model=list[MilestoneRead])
def list_milestones(
    epic: str | None = None,
    projet_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> list[Milestone]:
    q = select(Milestone).order_by(Milestone.date)
    if epic:
        q = q.where(Milestone.epic_trigramme == epic.upper())
    if projet_id is not None:
        q = q.where(Milestone.project_id == projet_id)
    return list(db.execute(q).scalars().all())


@router.post("", response_model=MilestoneRead, status_code=status.HTTP_201_CREATED)
def create_milestone(
    payload: MilestoneCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> Milestone:
    m = Milestone(**payload.model_dump(), updated_by_id=me.id)
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
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(m, k, v)
    m.updated_by_id = me.id
    _validate(m, db)
    db.commit()
    db.refresh(m)
    return m


@router.delete("/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_milestone(
    milestone_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> None:
    m = db.get(Milestone, milestone_id)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Milestone introuvable")
    db.delete(m)
    db.commit()
