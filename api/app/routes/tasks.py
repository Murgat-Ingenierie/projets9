from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.invariants import InvariantError
from app.invariants.checks import check_task_dates
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.routes.errors import http_from_invariant
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _validate(t: Task, db: Session) -> None:
    project = db.get(Project, t.projet_id)
    if project is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"code": "INV-4", "message": f"Projet {t.projet_id} inconnu"},
        )
    try:
        check_task_dates(t)
    except InvariantError as e:
        raise http_from_invariant(e) from None


@router.get("", response_model=list[TaskRead])
def list_tasks(
    projet_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> list[Task]:
    q = select(Task).order_by(Task.id)
    if projet_id is not None:
        q = q.where(Task.projet_id == projet_id)
    return list(db.execute(q).scalars().all())


@router.get("/{task_id}", response_model=TaskRead)
def get_task(
    task_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)
) -> Task:
    t = db.get(Task, task_id)
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task introuvable")
    return t


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> Task:
    t = Task(**payload.model_dump(), updated_by_id=me.id)
    _validate(t, db)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.put("/{task_id}", response_model=TaskRead)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> Task:
    t = db.get(Task, task_id)
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task introuvable")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    t.updated_by_id = me.id
    _validate(t, db)
    db.commit()
    db.refresh(t)
    return t


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> None:
    t = db.get(Task, task_id)
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task introuvable")
    db.delete(t)
    db.commit()
