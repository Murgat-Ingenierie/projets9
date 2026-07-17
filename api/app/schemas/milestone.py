import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import TimestampedRead


class MilestoneBase(BaseModel):
    nom: str = Field(min_length=1, max_length=255)
    date: datetime.date
    atteint: bool = False
    project_ids: list[int] = Field(min_length=1)

    @field_validator("project_ids")
    @classmethod
    def _dedup_project_ids(cls, v: list[int]) -> list[int]:
        seen: set[int] = set()
        out: list[int] = []
        for pid in v:
            if not isinstance(pid, int) or pid <= 0:
                raise ValueError("project_id doit être un entier positif")
            if pid in seen:
                continue
            seen.add(pid)
            out.append(pid)
        if not out:
            raise ValueError("Au moins un projet doit être rattaché au jalon")
        return out


class MilestoneCreate(MilestoneBase):
    pass


class MilestoneUpdate(BaseModel):
    nom: str | None = Field(default=None, min_length=1, max_length=255)
    date: datetime.date | None = None
    atteint: bool | None = None
    project_ids: list[int] | None = Field(default=None, min_length=1)

    @field_validator("project_ids")
    @classmethod
    def _dedup_project_ids(cls, v: list[int] | None) -> list[int] | None:
        if v is None:
            return None
        return MilestoneBase._dedup_project_ids.__func__(cls, v)


class MilestoneRead(TimestampedRead):
    id: int
    nom: str
    date: datetime.date
    atteint: bool
    project_ids: list[int]
