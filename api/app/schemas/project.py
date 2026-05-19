from datetime import date

from pydantic import BaseModel, Field

from app.models.project import ProjectStatus
from app.schemas.common import TimestampedRead


class ProjectBase(BaseModel):
    nom: str = Field(min_length=1, max_length=255)
    description: str | None = None
    date_debut: date
    date_fin: date
    statut: ProjectStatus = ProjectStatus.prevu
    responsable_id: int | None = None


class ProjectCreate(ProjectBase):
    epic_trigramme: str = Field(min_length=3, max_length=3)


class ProjectUpdate(BaseModel):
    nom: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    date_debut: date | None = None
    date_fin: date | None = None
    statut: ProjectStatus | None = None
    responsable_id: int | None = None
    epic_trigramme: str | None = Field(default=None, min_length=3, max_length=3)


class ProjectRead(ProjectBase, TimestampedRead):
    id: int
    epic_trigramme: str
