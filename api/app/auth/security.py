from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.config import settings

# bcrypt ne prend en compte que les 72 premiers octets d'un mot de passe ;
# depuis bcrypt 5 il lève au-delà au lieu de tronquer en silence. On tronque
# donc explicitement, ce qui reproduit exactement l'ancien comportement de
# passlib — dont on se débarrasse : passlib n'est plus maintenu (depuis 2020) et
# casse dès bcrypt 4.1+ (il lit `bcrypt.__about__`, supprimé depuis). Les
# hachages `$2b$` déjà en base restent vérifiables (même algorithme, même
# format) — vérifié contre bcrypt 5.0.0 avant migration.
_BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    digest = bcrypt.hashpw(password.encode("utf-8")[:_BCRYPT_MAX_BYTES], bcrypt.gensalt())
    return digest.decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:_BCRYPT_MAX_BYTES], hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_expires_min)).timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
