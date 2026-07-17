"""Jalons : passage à N-N avec les projets (au lieu des epics).

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-29

- Création de la table d'association `milestone_project`
- Expansion des liens existants : (jalon, epic) → (jalon, projet) pour chaque
  projet de cet epic. Les jalons rattachés à un epic sans projet deviennent
  orphelins (ils restent dans `milestones` mais sans entrée dans `milestone_project`).
- Suppression de l'ancienne table `milestone_epic`.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "milestone_project",
        sa.Column(
            "milestone_id",
            sa.Integer(),
            sa.ForeignKey("milestones.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_index("ix_milestone_project_milestone_id", "milestone_project", ["milestone_id"])
    op.create_index("ix_milestone_project_project_id", "milestone_project", ["project_id"])

    # Migration des données : (jalon, epic) → (jalon, projet) pour chaque
    # projet appartenant à cet epic. ON CONFLICT pour ignorer les doublons si
    # un jalon était lié à plusieurs epics partageant... (impossible ici, mais
    # bonne hygiène).
    op.execute(
        """
        INSERT INTO milestone_project (milestone_id, project_id)
        SELECT DISTINCT me.milestone_id, p.id
        FROM milestone_epic me
        JOIN projects p ON p.epic_trigramme = me.epic_trigramme
        ON CONFLICT DO NOTHING
        """
    )

    op.drop_index("ix_milestone_epic_epic_trigramme", table_name="milestone_epic")
    op.drop_index("ix_milestone_epic_milestone_id", table_name="milestone_epic")
    op.drop_table("milestone_epic")


def downgrade() -> None:
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
    # Best-effort : repropage chaque (jalon, projet) → (jalon, epic du projet)
    op.execute(
        """
        INSERT INTO milestone_epic (milestone_id, epic_trigramme)
        SELECT DISTINCT mp.milestone_id, p.epic_trigramme
        FROM milestone_project mp
        JOIN projects p ON p.id = mp.project_id
        ON CONFLICT DO NOTHING
        """
    )
    op.drop_index("ix_milestone_project_project_id", table_name="milestone_project")
    op.drop_index("ix_milestone_project_milestone_id", table_name="milestone_project")
    op.drop_table("milestone_project")
