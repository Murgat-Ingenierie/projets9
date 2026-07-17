from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.invariants import InvariantError
from app.invariants.checks import (
    check_dependency_acyclic,
    check_dependency_no_self,
)
from app.models.dependency import Dependency
from app.models.task import Task
from app.models.user import User
from app.routes.errors import http_from_invariant
from app.schemas.dependency import DependencyCreate, DependencyRead

router = APIRouter(prefix="/api/dependencies", tags=["dependencies"])


@router.get("", response_model=list[DependencyRead])
def list_deps(
    db: Session = Depends(get_db), _=Depends(get_current_user)
) -> list[Dependency]:
    return list(db.execute(select(Dependency).order_by(Dependency.id)).scalars().all())


@router.post("", response_model=DependencyRead, status_code=status.HTTP_201_CREATED)
def create_dep(
    payload: DependencyCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> Dependency:
    amont = db.get(Task, payload.tache_amont_id)
    aval = db.get(Task, payload.tache_aval_id)
    if amont is None or aval is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tâche amont ou aval introuvable")

    new = Dependency(
        tache_amont_id=payload.tache_amont_id,
        tache_aval_id=payload.tache_aval_id,
        type=payload.type,
        updated_by_id=me.id,
    )

    try:
        check_dependency_no_self(new)
        existing = list(db.execute(select(Dependency)).scalars().all())
        check_dependency_acyclic(existing, new_edge=new)
    except InvariantError as e:
        raise http_from_invariant(e) from None

    db.add(new)
    db.commit()
    db.refresh(new)
    return new


@router.delete("/{dep_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dep(
    dep_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> None:
    d = db.get(Dependency, dep_id)
    if d is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dépendance introuvable")
    db.delete(d)
    db.commit()
