"""Simplifie l'enum task_status à ouvert / archive

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-22

Mapping des données :
- prevu, en_cours → ouvert
- realise, abandonne → archive
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE task_status RENAME TO task_status_old")
    sa.Enum("ouvert", "archive", name="task_status").create(op.get_bind(), checkfirst=False)
    op.execute(
        """
        ALTER TABLE tasks
        ALTER COLUMN statut TYPE task_status USING (
            CASE
                WHEN statut::text IN ('realise', 'abandonne') THEN 'archive'::task_status
                ELSE 'ouvert'::task_status
            END
        )
        """
    )
    op.execute("DROP TYPE task_status_old")


def downgrade() -> None:
    op.execute("ALTER TYPE task_status RENAME TO task_status_old")
    sa.Enum("prevu", "en_cours", "realise", "abandonne", name="task_status").create(
        op.get_bind(), checkfirst=False
    )
    op.execute(
        """
        ALTER TABLE tasks
        ALTER COLUMN statut TYPE task_status USING (
            CASE
                WHEN statut::text = 'archive' THEN 'realise'::task_status
                ELSE 'prevu'::task_status
            END
        )
        """
    )
    op.execute("DROP TYPE task_status_old")
