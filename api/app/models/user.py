import enum

from sqlalchemy import Boolean, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, TimestampMixin


class UserRole(str, enum.Enum):
    admin = "admin"
    membre = "membre"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nom: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # Pont vers Keycloak : `sub` du jeton (UUID). Identifiant STABLE, contrairement
    # à l'email qui peut changer dans le realm. Nullable : les comptes créés avant
    # l'adossement (et l'admin de seed) n'en ont pas tant qu'ils ne se sont pas
    # connectés une première fois via OIDC.
    keycloak_sub: Mapped[str | None] = mapped_column(
        String(36), nullable=True, unique=True, index=True
    )
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), nullable=False, default=UserRole.membre
    )
    actif: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
