from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, TimestampMixin


class TaskTodo(Base, TimestampMixin):
    """Point de contrôle à l'intérieur d'une tâche : un libellé, une case.

    Volontairement PAS une sous-tâche. La hiérarchie du produit s'arrête à
    Epic → Projet → Tâche, et tout ce qui porte des dates, un responsable ou des
    dépendances est une tâche. Un todo n'a rien de tout cela : il ne pèse sur
    aucun planning, aucune charge, aucun invariant. C'est la liste qu'on coche en
    faisant le travail.

    Pas de colonne d'ordre : la liste suit l'ordre de création (`id`). Ajouter un
    rang que rien ne ferait varier serait du code mort avant même d'être écrit —
    le jour où l'on voudra réordonner, c'est une migration d'une colonne.
    """

    __tablename__ = "task_todos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tache_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    libelle: Mapped[str] = mapped_column(String(200), nullable=False)
    fait: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
