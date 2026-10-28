from pydantic import BaseModel, model_validator

from app.models.dependency import DependencyType
from app.schemas.common import TimestampedRead


class DependencyCreate(BaseModel):
    """Le prédécesseur est une tâche OU la fin d'un projet (#141), jamais les deux.

    Refusé ici en 422 plutôt qu'en 409 : c'est la FORME de la requête qui est
    fausse, pas un état métier — même convention qu'INV-1. La base porte la même
    règle (`ck_dependency_amont_unique`, `ck_dependency_projet_fs`).
    """

    tache_amont_id: int | None = None
    projet_amont_id: int | None = None
    tache_aval_id: int
    type: DependencyType = DependencyType.FS

    @model_validator(mode="after")
    def _un_seul_predecesseur(self) -> "DependencyCreate":
        if (self.tache_amont_id is None) == (self.projet_amont_id is None):
            raise ValueError(
                "Renseigner exactement un prédécesseur : tache_amont_id ou projet_amont_id"
            )
        if self.projet_amont_id is not None and self.type != DependencyType.FS:
            raise ValueError("Un projet ne précède une tâche que par sa fin (type FS)")
        return self


class DependencyUpdate(BaseModel):
    """Seul le TYPE est modifiable — pas les extrémités.

    Ce n'est pas une limitation par prudence mais une propriété qu'on veut
    garder : INV-14 (le graphe reste acyclique) et INV-15 (pas d'auto-dépendance)
    ne regardent QUE les extrémités (`tache_amont_id` ou `projet_amont_id`, et
    `tache_aval_id`). Tant qu'on ne touche pas aux extrémités, aucune
    modification ne peut les violer, et la route n'a donc rien à rejouer.

    Déplacer une extrémité reste possible : on supprime et on recrée, ce qui
    repasse par les contrôles de la création. Si ce schéma venait à s'ouvrir aux
    extrémités, il faudrait y remettre `check_dependency_no_self` et
    `check_dependency_acyclic` — c'est la seule raison pour laquelle ils sont
    absents de `update_dep`.

    Champ REQUIS : un PUT qui ne changerait rien n'a pas de sens ici, il n'y a
    qu'un champ.
    """

    type: DependencyType


class DependencyRead(TimestampedRead):
    id: int
    tache_amont_id: int | None
    projet_amont_id: int | None
    tache_aval_id: int
    type: DependencyType
