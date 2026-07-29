from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_admin
from app.database import get_db
from app.invariants import InvariantError
from app.invariants.checks import (
    check_epic_basics,
    check_epic_date_order,
    check_epic_realise_consistency,
    check_epic_trigramme,
)
from app.models.epic import Epic
from app.models.milestone import Milestone
from app.models.project import Project
from app.models.user import User
from app.routes.errors import http_from_invariant
from app.routes.milestone_guard import refuser_si_jalons_orphelins
from app.schemas.epic import EpicCreate, EpicRead, EpicUpdate

router = APIRouter(prefix="/api/epics", tags=["epics"])


def _validate(epic: Epic, db: Session) -> None:
    try:
        check_epic_trigramme(epic.trigramme)
        check_epic_basics(epic)
        check_epic_date_order(epic)
        if epic.statut == "realise":
            projects = list(
                db.execute(select(Project).where(Project.epic_trigramme == epic.trigramme))
                .scalars()
                .all()
            )
            milestones = list(
                db.execute(
                    select(Milestone)
                    .join(Milestone.projects)
                    .where(Project.epic_trigramme == epic.trigramme)
                )
                .scalars()
                .unique()
                .all()
            )
            check_epic_realise_consistency(epic, projects, milestones)
    except InvariantError as e:
        raise http_from_invariant(e) from None


@router.get("", response_model=list[EpicRead])
def list_epics(db: Session = Depends(get_db), _=Depends(get_current_user)) -> list[Epic]:
    return list(db.execute(select(Epic).order_by(Epic.trigramme)).scalars().all())


@router.get("/{trigramme}", response_model=EpicRead)
def get_epic(
    trigramme: str, db: Session = Depends(get_db), _=Depends(get_current_user)
) -> Epic:
    e = db.get(Epic, trigramme.upper())
    if e is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Epic introuvable")
    return e


@router.post("", response_model=EpicRead, status_code=status.HTTP_201_CREATED)
def create_epic(
    payload: EpicCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> Epic:
    if db.get(Epic, payload.trigramme) is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"code": "INV-1", "message": "Trigramme déjà utilisé"},
        )
    epic = Epic(**payload.model_dump(), updated_by_id=me.id)
    _validate(epic, db)
    db.add(epic)
    db.commit()
    db.refresh(epic)
    return epic


@router.put("/{trigramme}", response_model=EpicRead)
def update_epic(
    trigramme: str,
    payload: EpicUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> Epic:
    epic = db.get(Epic, trigramme.upper())
    if epic is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Epic introuvable")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(epic, k, v)
    epic.updated_by_id = me.id
    _validate(epic, db)
    db.commit()
    db.refresh(epic)
    return epic


@router.delete("/{trigramme}", status_code=status.HTTP_204_NO_CONTENT)
def delete_epic(
    trigramme: str,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
) -> None:
    epic = db.get(Epic, trigramme.upper())
    if epic is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Epic introuvable")
    # Supprimer l'epic cascade sur ses projets : on refuse si cela orphelinerait
    # un jalon (INV-6), même par ce chemin indirect.
    project_ids = set(
        db.execute(select(Project.id).where(Project.epic_trigramme == epic.trigramme))
        .scalars()
        .all()
    )
    refuser_si_jalons_orphelins(db, project_ids)
    db.delete(epic)
    db.commit()
