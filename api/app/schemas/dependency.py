from pydantic import BaseModel

from app.models.dependency import DependencyType
from app.schemas.common import TimestampedRead


class DependencyCreate(BaseModel):
    tache_amont_id: int
    tache_aval_id: int
    type: DependencyType = DependencyType.FS


class DependencyRead(TimestampedRead):
    id: int
    tache_amont_id: int
    tache_aval_id: int
    type: DependencyType
