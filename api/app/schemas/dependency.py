from pydantic import BaseModel

from app.models.dependency import DependencyType
from app.schemas.common import TimestampedRead


class DependencyCreate(BaseModel):
    tache_amont_id: int
    tache_aval_id: int
    type: DependencyType = DependencyType.FS


class DependencyUpdate(BaseModel):
    """Seul le TYPE est modifiable — pas les extrémités.

    Ce n'est pas une limitation par prudence mais une propriété qu'on veut
    garder : INV-14 (le graphe reste acyclique) et INV-15 (pas d'auto-dépendance)
    ne regardent QUE `tache_amont_id` et `tache_aval_id`. Tant qu'on ne touche
    pas aux extrémités, aucune modification ne peut les violer, et la route n'a
    donc rien à rejouer.

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
    tache_amont_id: int
    tache_aval_id: int
    type: DependencyType
