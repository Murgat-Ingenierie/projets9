from datetime import date

from pydantic import BaseModel, Field

from app.models.task import TaskStatus
from app.schemas.common import TimestampedRead


class TaskBase(BaseModel):
    nom: str = Field(min_length=1, max_length=255)
    date_debut: date
    date_fin: date
    avancement: int = Field(default=0, ge=0, le=100)
    responsable_id: int | None = None
    statut: TaskStatus = TaskStatus.prevu


class TaskCreate(TaskBase):
    projet_id: int


class TaskUpdate(BaseModel):
    nom: str | None = Field(default=None, min_length=1, max_length=255)
    date_debut: date | None = None
    date_fin: date | None = None
    avancement: int | None = Field(default=None, ge=0, le=100)
    responsable_id: int | None = None
    statut: TaskStatus | None = None
    projet_id: int | None = None


class TaskRead(TaskBase, TimestampedRead):
    id: int
    projet_id: int
