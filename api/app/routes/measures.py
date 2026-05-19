from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.invariants import InvariantError
from app.invariants.checks import check_measure_unit_consistency
from app.models.epic import Epic
from app.models.measure import Measure
from app.models.user import User
from app.routes.errors import http_from_invariant
from app.schemas.measure import MeasureCreate, MeasureRead, MeasureUpdate

router = APIRouter(prefix="/api/measures", tags=["measures"])


@router.get("", response_model=list[MeasureRead])
def list_measures(
    epic: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> list[Measure]:
    q = select(Measure).order_by(Measure.date)
    if epic:
        q = q.where(Measure.epic_trigramme == epic.upper())
    return list(db.execute(q).scalars().all())


@router.post("", response_model=MeasureRead, status_code=status.HTTP_201_CREATED)
def create_measure(
    payload: MeasureCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> Measure:
    epic = db.get(Epic, payload.epic_trigramme)
    if epic is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Epic inconnu")

    new = Measure(**payload.model_dump(), updated_by_id=me.id)
    existing = list(
        db.execute(select(Measure).where(Measure.epic_trigramme == payload.epic_trigramme))
        .scalars()
        .all()
    )
    try:
        check_measure_unit_consistency(new, existing)
    except InvariantError as e:
        raise http_from_invariant(e) from None
    db.add(new)
    db.commit()
    db.refresh(new)
    return new


@router.put("/{measure_id}", response_model=MeasureRead)
def update_measure(
    measure_id: int,
    payload: MeasureUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> Measure:
    m = db.get(Measure, measure_id)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mesure introuvable")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(m, k, v)
    m.updated_by_id = me.id
    existing = list(
        db.execute(
            select(Measure).where(
                Measure.epic_trigramme == m.epic_trigramme, Measure.id != m.id
            )
        )
        .scalars()
        .all()
    )
    try:
        check_measure_unit_consistency(m, existing)
    except InvariantError as e:
        raise http_from_invariant(e) from None
    db.commit()
    db.refresh(m)
    return m


@router.delete("/{measure_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_measure(
    measure_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> None:
    m = db.get(Measure, measure_id)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mesure introuvable")
    db.delete(m)
    db.commit()
