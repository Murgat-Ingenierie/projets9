import enum
from datetime import date

from sqlalchemy import Boolean, Date, Enum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin


class EpicStatus(str, enum.Enum):
    idee = "idee"
    actif = "actif"
    realise = "realise"
    abandonne = "abandonne"


class EpicCategory(str, enum.Enum):
    operationnel = "operationnel"
    strategique = "strategique"
    long_terme = "long_terme"


class Epic(Base, TimestampMixin):
    __tablename__ = "epics"

    trigramme: Mapped[str] = mapped_column(String(3), primary_key=True)
    nom: Mapped[str] = mapped_column(String(255), nullable=False)
    critere_reussite: Mapped[str | None] = mapped_column(Text, nullable=True)
    raison_date_fin: Mapped[str | None] = mapped_column(Text, nullable=True)
    date_fin_prevue: Mapped[date | None] = mapped_column(Date, nullable=True)
    jalon_fin_max: Mapped[date | None] = mapped_column(Date, nullable=True)
    statut: Mapped[EpicStatus] = mapped_column(
        Enum(EpicStatus, name="epic_status"), nullable=False, default=EpicStatus.idee
    )
    categorie: Mapped[EpicCategory] = mapped_column(
        Enum(EpicCategory, name="epic_category"),
        nullable=False,
        default=EpicCategory.operationnel,
    )
    critere_atteint: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    projects = relationship("Project", back_populates="epic", cascade="all, delete-orphan")
    milestones = relationship(
        "Milestone",
        primaryjoin="and_(Milestone.epic_trigramme==Epic.trigramme)",
        cascade="all, delete-orphan",
        viewonly=False,
    )
    measures = relationship("Measure", back_populates="epic", cascade="all, delete-orphan")
