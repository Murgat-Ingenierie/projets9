from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.invariants import (
    InvariantError,
    check_allocation_heures,
    check_allocation_refs,
    check_allocation_unique,
)
from app.models.equipe import Equipe, TacheEquipe
from app.models.task import Task
from app.models.user import User
from app.routes.errors import http_from_invariant
from app.schemas.equipe import TacheEquipeCreate, TacheEquipeRead, TacheEquipeUpdate

router = APIRouter(prefix="/api/tache-equipe", tags=["tache-equipe"])


@router.get("", response_model=list[TacheEquipeRead])
def list_all(
    db: Session = Depends(get_db), _=Depends(get_current_user)
) -> list[TacheEquipe]:
    return list(
        db.execute(select(TacheEquipe).order_by(TacheEquipe.id)).scalars().all()
    )


@router.post("", response_model=TacheEquipeRead, status_code=status.HTTP_201_CREATED)
def create(
    payload: TacheEquipeCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> TacheEquipe:
    couples = list(
        db.execute(select(TacheEquipe.tache_id, TacheEquipe.equipe_id)).all()
    )
    try:
        # INV-EQ-5 : renvoie 409 + code, comme INV-4 pour un projet inconnu —
        # et non 404, qui ne portait aucun identifiant d'invariant.
        check_allocation_refs(
            payload.tache_id,
            payload.equipe_id,
            tache_existe=db.get(Task, payload.tache_id) is not None,
            equipe_existe=db.get(Equipe, payload.equipe_id) is not None,
        )
        check_allocation_heures(payload.heures_allouees)
        check_allocation_unique(
            payload.tache_id, payload.equipe_id, [(t, e) for t, e in couples]
        )
    except InvariantError as e:
        raise http_from_invariant(e) from None

    new = TacheEquipe(
        tache_id=payload.tache_id,
        equipe_id=payload.equipe_id,
        heures_allouees=payload.heures_allouees,
        updated_by_id=me.id,
    )
    db.add(new)
    db.commit()
    db.refresh(new)
    return new


@router.put("/{te_id}", response_model=TacheEquipeRead)
def update(
    te_id: int,
    payload: TacheEquipeUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> TacheEquipe:
    te = db.get(TacheEquipe, te_id)
    if te is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Allocation introuvable")
    try:
        check_allocation_heures(payload.heures_allouees)
    except InvariantError as e:
        raise http_from_invariant(e) from None
    te.heures_allouees = payload.heures_allouees
    te.updated_by_id = me.id
    db.commit()
    db.refresh(te)
    return te


@router.delete("/{te_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    te_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)
) -> None:
    te = db.get(TacheEquipe, te_id)
    if te is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Allocation introuvable")
    db.delete(te)
    db.commit()
