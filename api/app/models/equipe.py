from sqlalchemy import CheckConstraint, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, TimestampMixin


class Equipe(Base, TimestampMixin):
    __tablename__ = "equipes"
    __table_args__ = (
        CheckConstraint("temps_dispo_hebdo >= 0", name="ck_equipe_temps_dispo_positif"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nom: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    temps_dispo_hebdo: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    updated_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)


class TacheEquipe(Base, TimestampMixin):
    __tablename__ = "tache_equipe"
    __table_args__ = (
        CheckConstraint("heures_allouees > 0", name="ck_tache_equipe_heures_positives"),
        UniqueConstraint("tache_id", "equipe_id", name="uq_tache_equipe"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tache_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    equipe_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("equipes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    heures_allouees: Mapped[float] = mapped_column(Float, nullable=False)
    updated_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
