from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user, hash_password, require_admin
from app.config import settings
from app.database import get_db
from app.invariants import (
    InvariantError,
    check_max_active_users,
    check_min_one_admin,
)
from app.models.user import User
from app.routes.errors import http_from_invariant
from app.schemas.user import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


def _check_global_user_invariants(db: Session, candidate_view: list[User]) -> None:
    """Vérifie les invariants globaux après mutation."""
    active = [u for u in candidate_view if u.actif]
    try:
        check_max_active_users(len(active), limit=settings.max_active_users)
        check_min_one_admin(candidate_view)
    except InvariantError as e:
        raise http_from_invariant(e) from None


def _all_users_view(db: Session, override: User, removed: bool = False) -> list[User]:
    users = list(db.execute(select(User)).scalars().all())
    out: list[User] = []
    for u in users:
        if u.id == override.id:
            if not removed:
                out.append(override)
        else:
            out.append(u)
    if override.id is None and not removed:
        out.append(override)
    return out


@router.get("", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db), _=Depends(get_current_user)
) -> list[User]:
    return list(db.execute(select(User).order_by(User.id)).scalars().all())


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    me: User = Depends(require_admin),
) -> User:
    existing = db.execute(
        select(User).where(func.lower(User.email) == payload.email.lower())
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"code": "INV-AUTH-1", "message": "Email déjà utilisé"},
        )
    new = User(
        nom=payload.nom,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        actif=payload.actif,
        updated_by_id=me.id,
    )
    _check_global_user_invariants(db, _all_users_view(db, new))
    db.add(new)
    db.commit()
    db.refresh(new)
    return new


@router.put("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(require_admin),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User introuvable")

    if payload.email is not None:
        other = db.execute(
            select(User).where(
                func.lower(User.email) == payload.email.lower(), User.id != user.id
            )
        ).scalar_one_or_none()
        if other is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail={"code": "INV-AUTH-1", "message": "Email déjà utilisé"},
            )
        user.email = payload.email
    if payload.nom is not None:
        user.nom = payload.nom
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)
    if payload.role is not None:
        user.role = payload.role
    if payload.actif is not None:
        user.actif = payload.actif
    user.updated_by_id = me.id

    _check_global_user_invariants(db, _all_users_view(db, user))
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(require_admin),
) -> None:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User introuvable")
    view = _all_users_view(db, user, removed=True)
    try:
        check_min_one_admin(view)
    except InvariantError as e:
        raise http_from_invariant(e) from None
    db.delete(user)
    db.commit()


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)) -> User:
    return user
