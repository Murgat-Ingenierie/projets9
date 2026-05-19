import enum
from datetime import date

from sqlalchemy import CheckConstraint, Date, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin


class TaskStatus(str, enum.Enum):
    prevu = "prevu"
    en_cours = "en_cours"
    realise = "realise"
    abandonne = "abandonne"


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("avancement >= 0 AND avancement <= 100", name="ck_task_avancement_range"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    projet_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nom: Mapped[str] = mapped_column(String(255), nullable=False)
    date_debut: Mapped[date] = mapped_column(Date, nullable=False)
    date_fin: Mapped[date] = mapped_column(Date, nullable=False)
    avancement: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    responsable_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    statut: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus, name="task_status"), nullable=False, default=TaskStatus.prevu
    )
    updated_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    project = relationship("Project", back_populates="tasks")
