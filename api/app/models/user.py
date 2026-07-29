import enum

from sqlalchemy import Boolean, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, TimestampMixin


class UserRole(str, enum.Enum):
    admin = "admin"
    membre = "membre"


class User(Base, TimestampMixin):
    """Reflet local d'une identité Keycloak.

    Cette table ne contient plus aucun secret : depuis le retrait du login
    maison, elle n'existe que parce que `projects.responsable_id` et
    `tasks.responsable_id` ont besoin d'une clé étrangère (cf. migration 0011,
    qui a supprimé `password_hash`).
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nom: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    # Pont vers Keycloak : `sub` du jeton (UUID). Identifiant STABLE, contrairement
    # à l'email qui peut changer dans le realm. Nullable : un compte créé à
    # l'avance (import du classeur, ajout manuel) n'en a pas tant que la personne
    # ne s'est pas connectée une première fois — c'est l'email qui les rapproche.
    keycloak_sub: Mapped[str | None] = mapped_column(
        String(36), nullable=True, unique=True, index=True
    )
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), nullable=False, default=UserRole.membre
    )
    actif: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
