from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole
from app.schemas.common import TimestampedRead


class UserCreate(BaseModel):
    nom: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    role: UserRole = UserRole.membre
    actif: bool = True


class UserUpdate(BaseModel):
    nom: str | None = Field(default=None, min_length=1, max_length=200)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=200)
    role: UserRole | None = None
    actif: bool | None = None


class UserRead(TimestampedRead):
    id: int
    nom: str
    email: EmailStr
    role: UserRole
    actif: bool


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
