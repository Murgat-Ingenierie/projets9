from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.invariants import (
    InvariantError,
    check_equipe_nom,
    check_equipe_nom_unique,
    check_equipe_temps_dispo,
)
from app.models.equipe import Equipe
from app.models.user import User
from app.routes.errors import http_from_invariant
from app.schemas.equipe import EquipeCreate, EquipeRead, EquipeUpdate

router = APIRouter(prefix="/api/equipes", tags=["equipes"])


def _validate(
    nom: str, temps_dispo_hebdo: float, db: Session, *, exclude_id: int | None = None
) -> None:
    """INV-EQ-1a, INV-EQ-1b, INV-EQ-2.

    `exclude_id` retire l'équipe en cours de modification de la comparaison
    d'unicité, sinon un renommage qui ne change que la casse échouerait.
    """
    q = select(Equipe.nom)
    if exclude_id is not None:
        q = q.where(Equipe.id != exclude_id)
    autres_noms = list(db.execute(q).scalars().all())
    try:
        check_equipe_nom(nom)
        check_equipe_temps_dispo(temps_dispo_hebdo)
        check_equipe_nom_unique(nom, autres_noms)
    except InvariantError as e:
        raise http_from_invariant(e) from None


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
    _validate(payload.nom, payload.temps_dispo_hebdo, db)
    new = Equipe(
        nom=payload.nom.strip(),
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

    nom = payload.nom if payload.nom is not None else eq.nom
    temps = (
        payload.temps_dispo_hebdo
        if payload.temps_dispo_hebdo is not None
        else eq.temps_dispo_hebdo
    )
    _validate(nom, temps, db, exclude_id=eq.id)

    eq.nom = nom.strip()
    eq.temps_dispo_hebdo = temps
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
