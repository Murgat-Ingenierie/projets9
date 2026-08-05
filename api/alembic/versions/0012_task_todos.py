"""Liste de contrôle à l'intérieur d'une tâche (`task_todos`).

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-05

Retour d'usage : « avoir une liste des todo dans une tâche ». Ce sont des points
à cocher, PAS des sous-tâches — la hiérarchie du produit s'arrête à
Epic → Projet → Tâche, et tout ce qui porte des dates, un responsable ou des
dépendances est une tâche. Un todo n'a rien de cela : il ne pèse sur aucun
planning, aucune charge, aucun invariant.

`ondelete="CASCADE"` : la liste n'existe qu'attachée à sa tâche. La conserver
après la suppression de celle-ci laisserait des lignes que plus rien ne désigne.

Pas de colonne d'ordre : la liste suit l'ordre de création. En ajouter une que
rien ne ferait varier serait du code mort dès l'écriture ; le jour où l'on
voudra réordonner, ce sera une migration d'une colonne.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "task_todos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tache_id",
            sa.Integer(),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("libelle", sa.String(length=200), nullable=False),
        sa.Column("fait", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_task_todos_tache_id", "task_todos", ["tache_id"])


def downgrade() -> None:
    op.drop_index("ix_task_todos_tache_id", table_name="task_todos")
    op.drop_table("task_todos")
