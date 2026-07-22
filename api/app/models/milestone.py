from datetime import date

from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin

# Table d'association N-N entre jalons et projets
milestone_project = Table(
    "milestone_project",
    Base.metadata,
    # index=True : la migration 0008 crée ces deux index mono-colonne (en plus
    # de la PK composite) ; on les déclare ici pour que le modèle reflète la
    # base et que `alembic check` reste vert.
    Column(
        "milestone_id",
        Integer,
        ForeignKey("milestones.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    ),
    Column(
        "project_id",
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    ),
)


class Milestone(Base, TimestampMixin):
    __tablename__ = "milestones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nom: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    atteint: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    projects = relationship("Project", secondary=milestone_project, lazy="selectin")

    @property
    def project_ids(self) -> list[int]:
        return [p.id for p in self.projects]
