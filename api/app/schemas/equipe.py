from pydantic import BaseModel, Field

from app.schemas.common import TimestampedRead


class EquipeCreate(BaseModel):
    nom: str = Field(min_length=1, max_length=200)
    temps_dispo_hebdo: float = Field(ge=0)


class EquipeUpdate(BaseModel):
    nom: str | None = Field(default=None, min_length=1, max_length=200)
    temps_dispo_hebdo: float | None = Field(default=None, ge=0)


class EquipeRead(TimestampedRead):
    id: int
    nom: str
    temps_dispo_hebdo: float


class TacheEquipeCreate(BaseModel):
    tache_id: int
    equipe_id: int
    heures_allouees: float = Field(gt=0)


class TacheEquipeUpdate(BaseModel):
    heures_allouees: float = Field(gt=0)


class TacheEquipeRead(TimestampedRead):
    id: int
    tache_id: int
    equipe_id: int
    heures_allouees: float
