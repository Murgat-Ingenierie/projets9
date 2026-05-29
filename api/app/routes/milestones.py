from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.invariants import InvariantError
from app.invariants.checks import (
    check_milestone_has_epics,
    check_milestone_within_epic_max,
)
from app.models.epic import Epic
from app.models.milestone import Milestone
from app.models.user import User
from app.routes.errors import http_from_invariant
from app.schemas.milestone import MilestoneCreate, MilestoneRead, MilestoneUpdate

router = APIRouter(prefix="/api/milestones", tags=["milestones"])


def _resolve_epics(db: Session, trigrammes: list[str]) -> list[Epic]:
    epics: list[Epic] = []
    for t in trigrammes:
        e = db.get(Epic, t)
        if e is None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail={"code": "INV-6", "message": f"Epic {t} inconnu"},
            )
        epics.append(e)
    return epics


def _validate(m: Milestone) -> None:
    try:
        check_milestone_has_epics([e.trigramme for e in m.epics])
        for e in m.epics:
            check_milestone_within_epic_max(m, e)
    except InvariantError as e:
        raise http_from_invariant(e) from None


@router.get("", response_model=list[MilestoneRead])
def list_milestones(
    epic: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> list[Milestone]:
    q = select(Milestone).order_by(Milestone.date)
    if epic:
        q = q.join(Milestone.epics).where(Epic.trigramme == epic.upper())
    return list(db.execute(q).scalars().unique().all())


@router.post("", response_model=MilestoneRead, status_code=status.HTTP_201_CREATED)
def create_milestone(
    payload: MilestoneCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> Milestone:
    epics = _resolve_epics(db, payload.epic_trigrammes)
    m = Milestone(
        nom=payload.nom,
        date=payload.date,
        atteint=payload.atteint,
        updated_by_id=me.id,
    )
    m.epics = epics
    _validate(m)
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
    if "epic_trigrammes" in data:
        m.epics = _resolve_epics(db, data["epic_trigrammes"])
    m.updated_by_id = me.id
    _validate(m)
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
