"""Tâches : suppression du champ avancement (0..100), remplacé par le seul `statut` ouvert/archive.

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-29

Charles a demandé de simplifier : une tâche est soit "fini" (archive) soit "pas fini" (ouvert),
le pourcentage d'avancement n'est plus suivi.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("tasks", "avancement")


def downgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column(
            "avancement",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
