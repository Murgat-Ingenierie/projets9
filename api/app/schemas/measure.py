import datetime

from pydantic import BaseModel, Field

from app.schemas.common import TimestampedRead


class MeasureCreate(BaseModel):
    epic_trigramme: str = Field(min_length=3, max_length=3)
    date: datetime.date
    valeur: float
    unite: str = Field(min_length=1, max_length=50)
    commentaire: str | None = None


class MeasureUpdate(BaseModel):
    date: datetime.date | None = None
    valeur: float | None = None
    unite: str | None = Field(default=None, min_length=1, max_length=50)
    commentaire: str | None = None


class MeasureRead(TimestampedRead):
    id: int
    epic_trigramme: str
    date: datetime.date
    valeur: float
    unite: str
    commentaire: str | None
