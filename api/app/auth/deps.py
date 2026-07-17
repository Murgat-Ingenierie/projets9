from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import decode_token
from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def _first_active_admin(db: Session) -> User:
    # .first() au lieu de .scalar_one_or_none() pour ne pas planter quand il y
    # a plusieurs admins (situation normale).
    user = db.execute(
        select(User)
        .where(User.actif == True, User.role == UserRole.admin)  # noqa: E712
        .order_by(User.id)
        .limit(1)
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "AUTH_DISABLED=true mais aucun admin actif en base",
        )
    return user


def get_current_user(
    token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    if settings.auth_disabled:
        return _first_active_admin(db)
    if token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token manquant")
    try:
        payload = decode_token(token)
        user_id = int(payload["sub"])
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token invalide") from None

    user = db.get(User, user_id)
    if user is None or not user.actif:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Utilisateur inactif ou inconnu")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if settings.auth_disabled:
        return user
    if user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux administrateurs")
    return user
