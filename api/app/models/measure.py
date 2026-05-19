from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin


class Measure(Base, TimestampMixin):
    __tablename__ = "measures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    epic_trigramme: Mapped[str] = mapped_column(
        String(3), ForeignKey("epics.trigramme", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    valeur: Mapped[float] = mapped_column(Float, nullable=False)
    unite: Mapped[str] = mapped_column(String(50), nullable=False)
    commentaire: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    epic = relationship("Epic", back_populates="measures")
