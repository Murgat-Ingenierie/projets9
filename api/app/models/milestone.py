from datetime import date

from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin

# Table d'association N-N entre jalons et epics
milestone_epic = Table(
    "milestone_epic",
    Base.metadata,
    Column(
        "milestone_id",
        Integer,
        ForeignKey("milestones.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "epic_trigramme",
        String(3),
        ForeignKey("epics.trigramme", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Milestone(Base, TimestampMixin):
    __tablename__ = "milestones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nom: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    atteint: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    epics = relationship("Epic", secondary=milestone_epic, lazy="selectin")

    @property
    def epic_trigrammes(self) -> list[str]:
        return [e.trigramme for e in self.epics]
