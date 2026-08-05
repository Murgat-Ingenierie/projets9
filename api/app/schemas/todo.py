from pydantic import BaseModel, Field

from app.schemas.common import TimestampedRead


class TodoCreate(BaseModel):
    tache_id: int
    libelle: str = Field(min_length=1, max_length=200)
    fait: bool = False


class TodoUpdate(BaseModel):
    """Mise à jour PARTIELLE : cocher ne doit pas exiger de renvoyer le libellé.

    Les deux champs sont donc optionnels, et la route applique `exclude_unset` —
    un champ absent est laissé tel quel, un champ fourni remplace.
    """

    libelle: str | None = Field(default=None, min_length=1, max_length=200)
    fait: bool | None = None


class TodoRead(TimestampedRead):
    id: int
    tache_id: int
    libelle: str
    fait: bool
