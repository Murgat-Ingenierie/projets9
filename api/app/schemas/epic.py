from datetime import date

from pydantic import BaseModel, Field

from app.models.epic import EpicCategory, EpicStatus
from app.schemas.common import TimestampedRead


COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"


class EpicBase(BaseModel):
    nom: str = Field(min_length=1, max_length=255)
    critere_reussite: str | None = None
    raison_date_fin: str | None = None
    date_fin_prevue: date | None = None
    jalon_fin_max: date | None = None
    statut: EpicStatus = EpicStatus.idee
    categorie: EpicCategory = EpicCategory.operationnel
    critere_atteint: bool = False
    couleur: str | None = Field(default=None, pattern=COLOR_PATTERN)


class EpicCreate(EpicBase):
    trigramme: str = Field(min_length=3, max_length=3, pattern=r"^[A-Z0-9]{3}$")


class EpicUpdate(BaseModel):
    nom: str | None = Field(default=None, min_length=1, max_length=255)
    critere_reussite: str | None = None
    raison_date_fin: str | None = None
    date_fin_prevue: date | None = None
    jalon_fin_max: date | None = None
    statut: EpicStatus | None = None
    categorie: EpicCategory | None = None
    critere_atteint: bool | None = None
    couleur: str | None = Field(default=None, pattern=COLOR_PATTERN)


class EpicRead(EpicBase, TimestampedRead):
    trigramme: str
