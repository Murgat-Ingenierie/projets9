from datetime import date

from pydantic import BaseModel, Field

from app.models.task import TaskStatus
from app.schemas.common import TimestampedRead


class TaskBase(BaseModel):
    nom: str = Field(min_length=1, max_length=255)
    date_debut: date
    date_fin: date
    responsable_id: int | None = None
    statut: TaskStatus = TaskStatus.ouvert


class TaskCreate(TaskBase):
    projet_id: int


class TaskUpdate(BaseModel):
    nom: str | None = Field(default=None, min_length=1, max_length=255)
    date_debut: date | None = None
    date_fin: date | None = None
    responsable_id: int | None = None
    statut: TaskStatus | None = None
    projet_id: int | None = None


class TaskRead(TaskBase, TimestampedRead):
    id: int
    projet_id: int
