import re
from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field

from app.models.user import UserRole
from app.schemas.common import TimestampedRead

# On ne se sert PAS de `EmailStr` : email-validator (derrière) refuse les TLD
# réservés comme `.local` comme « special-use », sans réglage pour l'autoriser
# (vérifié, y compris test_environment=True). Or l'app en a besoin —
# `.env.example` pose SEED_ADMIN_EMAIL=charles@lesfontaines.local, et sans ça
# on ne pourrait pas créer un compte suivant sa propre convention.
# On valide donc le format soi-même, en tolérant ces domaines internes.
# L'unicité (INV-AUTH-1) reste gérée côté route, insensible à la casse.
_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")


def _valider_email(v: str) -> str:
    v = v.strip()
    if not _EMAIL_RE.match(v):
        raise ValueError("Adresse email invalide")
    return v


Email = Annotated[str, AfterValidator(_valider_email)]


class UserCreate(BaseModel):
    nom: str = Field(min_length=1, max_length=200)
    email: Email
    password: str = Field(min_length=8, max_length=200)
    role: UserRole = UserRole.membre
    actif: bool = True


class UserUpdate(BaseModel):
    nom: str | None = Field(default=None, min_length=1, max_length=200)
    email: Email | None = None
    password: str | None = Field(default=None, min_length=8, max_length=200)
    role: UserRole | None = None
    actif: bool | None = None


class UserRead(TimestampedRead):
    id: int
    nom: str
    email: str
    role: UserRole
    actif: bool


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
