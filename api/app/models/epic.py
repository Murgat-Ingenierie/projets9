import enum
from datetime import date

from sqlalchemy import Date, Enum, Integer, String, Text
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
    couleur: Mapped[str | None] = mapped_column(String(7), nullable=True)
    updated_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    projects = relationship("Project", back_populates="epic", cascade="all, delete-orphan")
    # Plus de relation directe Epic↔Milestone : depuis la migration 0008 les
    # jalons sont rattachés aux projets (et non aux epics). On peut obtenir
    # les jalons d'un epic via : SELECT m FROM milestones m JOIN m.projects p
    # WHERE p.epic_trigramme = epic.trigramme.
    measures = relationship("Measure", back_populates="epic", cascade="all, delete-orphan")
