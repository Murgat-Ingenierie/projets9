"""Drop colonne critere_atteint sur Epic

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-19

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("epics", "critere_atteint")


def downgrade() -> None:
    op.add_column(
        "epics",
        sa.Column("critere_atteint", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
