import datetime

from pydantic import BaseModel, Field

from app.schemas.common import TimestampedRead


class ActiviteCreate(BaseModel):
    tache_id: int
    texte: str = Field(min_length=1, max_length=2000)


# Pas d'`ActiviteUpdate` : une entrée de journal ne se modifie pas. L'absence de
# ce schéma est délibérée, et c'est elle qui rend la route PUT impossible à
# écrire par distraction.


class ActiviteRead(TimestampedRead):
    id: int
    tache_id: int
    texte: str
    auteur_id: int | None
    auteur_nom: str
    created_at: datetime.datetime
