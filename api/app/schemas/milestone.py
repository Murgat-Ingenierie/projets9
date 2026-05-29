import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import TimestampedRead


class MilestoneBase(BaseModel):
    nom: str = Field(min_length=1, max_length=255)
    date: datetime.date
    atteint: bool = False
    epic_trigrammes: list[str] = Field(min_length=1)

    @field_validator("epic_trigrammes")
    @classmethod
    def _validate_epic_trigrammes(cls, v: list[str]) -> list[str]:
        normalized = []
        seen: set[str] = set()
        for t in v:
            if not isinstance(t, str) or len(t) != 3:
                raise ValueError("Chaque trigramme epic doit faire 3 caractères")
            up = t.upper()
            if up in seen:
                continue
            seen.add(up)
            normalized.append(up)
        if not normalized:
            raise ValueError("Au moins un epic doit être rattaché au jalon")
        return normalized


class MilestoneCreate(MilestoneBase):
    pass


class MilestoneUpdate(BaseModel):
    nom: str | None = Field(default=None, min_length=1, max_length=255)
    date: datetime.date | None = None
    atteint: bool | None = None
    epic_trigrammes: list[str] | None = Field(default=None, min_length=1)

    @field_validator("epic_trigrammes")
    @classmethod
    def _validate_epic_trigrammes(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        return MilestoneBase._validate_epic_trigrammes.__func__(cls, v)


class MilestoneRead(TimestampedRead):
    id: int
    nom: str
    date: datetime.date
    atteint: bool
    epic_trigrammes: list[str]
