from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.equipe import Equipe
from app.models.user import User
from app.schemas.equipe import EquipeCreate, EquipeRead, EquipeUpdate

router = APIRouter(prefix="/api/equipes", tags=["equipes"])


@router.get("", response_model=list[EquipeRead])
def list_equipes(db: Session = Depends(get_db), _=Depends(get_current_user)) -> list[Equipe]:
    return list(db.execute(select(Equipe).order_by(Equipe.id)).scalars().all())


@router.get("/{equipe_id}", response_model=EquipeRead)
def get_equipe(equipe_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)) -> Equipe:
    eq = db.get(Equipe, equipe_id)
    if eq is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Équipe introuvable")
    return eq


@router.post("", response_model=EquipeRead, status_code=status.HTTP_201_CREATED)
def create_equipe(
    payload: EquipeCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> Equipe:
    existing = db.execute(
        select(Equipe).where(func.lower(Equipe.nom) == payload.nom.lower())
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Nom d'équipe déjà utilisé")
    new = Equipe(
        nom=payload.nom,
        temps_dispo_hebdo=payload.temps_dispo_hebdo,
        updated_by_id=me.id,
    )
    db.add(new)
    db.commit()
    db.refresh(new)
    return new


@router.put("/{equipe_id}", response_model=EquipeRead)
def update_equipe(
    equipe_id: int,
    payload: EquipeUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> Equipe:
    eq = db.get(Equipe, equipe_id)
    if eq is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Équipe introuvable")
    if payload.nom is not None and payload.nom.lower() != eq.nom.lower():
        other = db.execute(
            select(Equipe).where(
                func.lower(Equipe.nom) == payload.nom.lower(), Equipe.id != eq.id
            )
        ).scalar_one_or_none()
        if other is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Nom d'équipe déjà utilisé")
        eq.nom = payload.nom
    if payload.temps_dispo_hebdo is not None:
        eq.temps_dispo_hebdo = payload.temps_dispo_hebdo
    eq.updated_by_id = me.id
    db.commit()
    db.refresh(eq)
    return eq


@router.delete("/{equipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipe(
    equipe_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> None:
    eq = db.get(Equipe, equipe_id)
    if eq is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Équipe introuvable")
    db.delete(eq)
    db.commit()
