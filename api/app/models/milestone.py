from datetime import date

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, TimestampMixin


class Milestone(Base, TimestampMixin):
    __tablename__ = "milestones"
    __table_args__ = (
        CheckConstraint(
            "(epic_trigramme IS NULL) <> (project_id IS NULL)",
            name="ck_milestone_xor_parent",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    epic_trigramme: Mapped[str | None] = mapped_column(
        String(3), ForeignKey("epics.trigramme", ondelete="CASCADE"), nullable=True
    )
    project_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True
    )
    nom: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    atteint: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
