"""Jalons : passage à N-N avec les epics, retrait de epic_trigramme / project_id.

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-29

- Création de la table d'association `milestone_epic`
- Copie de l'existant `milestones.epic_trigramme` dedans (un seul epic par jalon)
- Pour les jalons rattachés à un projet (project_id) : on copie l'epic du projet
- DROP des colonnes `epic_trigramme` et `project_id` de `milestones`
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "milestone_epic",
        sa.Column(
            "milestone_id",
            sa.Integer(),
            sa.ForeignKey("milestones.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "epic_trigramme",
            sa.String(3),
            sa.ForeignKey("epics.trigramme", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_index("ix_milestone_epic_milestone_id", "milestone_epic", ["milestone_id"])
    op.create_index("ix_milestone_epic_epic_trigramme", "milestone_epic", ["epic_trigramme"])

    # Migration des données existantes
    op.execute(
        """
        INSERT INTO milestone_epic (milestone_id, epic_trigramme)
        SELECT id, epic_trigramme
        FROM milestones
        WHERE epic_trigramme IS NOT NULL
        """
    )
    # Les jalons sur projet : on prend l'epic du projet parent
    op.execute(
        """
        INSERT INTO milestone_epic (milestone_id, epic_trigramme)
        SELECT m.id, p.epic_trigramme
        FROM milestones m
        JOIN projects p ON p.id = m.project_id
        WHERE m.project_id IS NOT NULL
        ON CONFLICT DO NOTHING
        """
    )

    op.drop_column("milestones", "epic_trigramme")
    op.drop_column("milestones", "project_id")


def downgrade() -> None:
    op.add_column(
        "milestones",
        sa.Column(
            "epic_trigramme",
            sa.String(3),
            sa.ForeignKey("epics.trigramme", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.add_column(
        "milestones",
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    # Restaure le premier epic associé (best effort, perte si plusieurs)
    op.execute(
        """
        UPDATE milestones m
        SET epic_trigramme = sub.epic_trigramme
        FROM (
            SELECT milestone_id, MIN(epic_trigramme) AS epic_trigramme
            FROM milestone_epic
            GROUP BY milestone_id
        ) sub
        WHERE sub.milestone_id = m.id
        """
    )
    op.drop_index("ix_milestone_epic_epic_trigramme", table_name="milestone_epic")
    op.drop_index("ix_milestone_epic_milestone_id", table_name="milestone_epic")
    op.drop_table("milestone_epic")
