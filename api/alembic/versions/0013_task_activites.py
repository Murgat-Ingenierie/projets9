"""Journal d'activité d'une tâche (`task_activites`).

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-05

Retour d'usage : « avoir une notion d'activité dans chaque tâche ("j'ai vissé les
boulons c'était super") ». Un compte rendu de ce qui a été fait, horodaté et
signé.

IMMUABLE : aucune route ne modifie une entrée. C'est ce qui en fait une trace
plutôt qu'une note. La suppression existe mais est réservée aux administrateurs
— ouverte à tous, elle autoriserait la réécriture par contournement.

`auteur_nom` est une COPIE du nom au moment de l'écriture, à côté de
`auteur_id`. Un journal dit qui a écrit, à cette date-là : renommer un compte
ensuite ne doit pas réécrire l'histoire, et le supprimer ne doit pas laisser des
entrées anonymes — `auteur_id` n'est FK vers rien, comme `updated_by_id` partout
ailleurs dans ce schéma.

`ondelete="CASCADE"` : le journal n'existe qu'attaché à sa tâche.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "task_activites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tache_id",
            sa.Integer(),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("texte", sa.Text(), nullable=False),
        sa.Column("auteur_id", sa.Integer(), nullable=True),
        sa.Column("auteur_nom", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_task_activites_tache_id", "task_activites", ["tache_id"])


def downgrade() -> None:
    op.drop_index("ix_task_activites_tache_id", table_name="task_activites")
    op.drop_table("task_activites")
