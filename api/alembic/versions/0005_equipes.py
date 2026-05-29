"""Ajoute les équipes et leur allocation horaire sur les tâches.

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "equipes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nom", sa.String(200), nullable=False, unique=True),
        sa.Column("temps_dispo_hebdo", sa.Float(), nullable=False, server_default=sa.text("0")),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("temps_dispo_hebdo >= 0", name="ck_equipe_temps_dispo_positif"),
    )

    op.create_table(
        "tache_equipe",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tache_id",
            sa.Integer(),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "equipe_id",
            sa.Integer(),
            sa.ForeignKey("equipes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("heures_allouees", sa.Float(), nullable=False),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("heures_allouees > 0", name="ck_tache_equipe_heures_positives"),
        sa.UniqueConstraint("tache_id", "equipe_id", name="uq_tache_equipe"),
    )
    op.create_index("ix_tache_equipe_tache_id", "tache_equipe", ["tache_id"])
    op.create_index("ix_tache_equipe_equipe_id", "tache_equipe", ["equipe_id"])


def downgrade() -> None:
    op.drop_index("ix_tache_equipe_equipe_id", table_name="tache_equipe")
    op.drop_index("ix_tache_equipe_tache_id", table_name="tache_equipe")
    op.drop_table("tache_equipe")
    op.drop_table("equipes")
