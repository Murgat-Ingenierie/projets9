from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.invariants import InvariantError
from app.invariants.checks import (
    check_project_dates,
    check_project_dates_within_epic,
    check_project_realise_consistency,
    check_task_dates_within_project,
)
from app.models.epic import Epic
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.routes.errors import http_from_invariant
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _validate(p: Project, db: Session) -> None:
    epic = db.get(Epic, p.epic_trigramme)
    if epic is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"code": "INV-5", "message": f"Epic {p.epic_trigramme} inconnu"},
        )
    try:
        check_project_dates(p)
        check_project_dates_within_epic(p, epic)
        tasks = list(db.execute(select(Task).where(Task.projet_id == p.id)).scalars().all())
        for t in tasks:
            check_task_dates_within_project(t, p)
        if p.statut == "realise":
            check_project_realise_consistency(p, tasks)
    except InvariantError as e:
        raise http_from_invariant(e) from None


@router.get("", response_model=list[ProjectRead])
def list_projects(
    epic: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> list[Project]:
    q = select(Project).order_by(Project.id)
    if epic:
        q = q.where(Project.epic_trigramme == epic.upper())
    return list(db.execute(q).scalars().all())


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)
) -> Project:
    p = db.get(Project, project_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project introuvable")
    return p


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> Project:
    p = Project(**payload.model_dump(), updated_by_id=me.id)
    _validate(p, db)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> Project:
    p = db.get(Project, project_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project introuvable")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    p.updated_by_id = me.id
    _validate(p, db)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> None:
    p = db.get(Project, project_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project introuvable")
    db.delete(p)
    db.commit()
