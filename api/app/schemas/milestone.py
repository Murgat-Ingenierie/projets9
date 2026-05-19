import datetime

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import TimestampedRead


class MilestoneBase(BaseModel):
    nom: str = Field(min_length=1, max_length=255)
    date: datetime.date
    atteint: bool = False
    epic_trigramme: str | None = Field(default=None, min_length=3, max_length=3)
    project_id: int | None = None

    @model_validator(mode="after")
    def _xor(self) -> "MilestoneBase":
        has_epic = self.epic_trigramme is not None
        has_proj = self.project_id is not None
        if has_epic == has_proj:
            raise ValueError("Jalon doit avoir epic_trigramme XOR project_id (INV-6)")
        return self


class MilestoneCreate(MilestoneBase):
    pass


class MilestoneUpdate(BaseModel):
    nom: str | None = Field(default=None, min_length=1, max_length=255)
    date: datetime.date | None = None
    atteint: bool | None = None


class MilestoneRead(TimestampedRead):
    id: int
    nom: str
    date: datetime.date
    atteint: bool
    epic_trigramme: str | None
    project_id: int | None
