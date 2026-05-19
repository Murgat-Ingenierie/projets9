"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-19

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    user_role = sa.Enum("admin", "membre", name="user_role")
    epic_status = sa.Enum("idee", "actif", "realise", "abandonne", name="epic_status")
    epic_category = sa.Enum(
        "operationnel", "strategique", "long_terme", name="epic_category"
    )
    project_status = sa.Enum(
        "prevu", "en_cours", "realise", "abandonne", name="project_status"
    )
    task_status = sa.Enum(
        "prevu", "en_cours", "realise", "abandonne", name="task_status"
    )
    dependency_type = sa.Enum("FS", "SS", "FF", name="dependency_type")

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nom", sa.String(200), nullable=False),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("actif", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "epics",
        sa.Column("trigramme", sa.String(3), primary_key=True),
        sa.Column("nom", sa.String(255), nullable=False),
        sa.Column("critere_reussite", sa.Text(), nullable=True),
        sa.Column("raison_date_fin", sa.Text(), nullable=True),
        sa.Column("date_fin_prevue", sa.Date(), nullable=True),
        sa.Column("jalon_fin_max", sa.Date(), nullable=True),
        sa.Column("statut", epic_status, nullable=False),
        sa.Column("categorie", epic_category, nullable=False),
        sa.Column(
            "critere_atteint", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "epic_trigramme",
            sa.String(3),
            sa.ForeignKey("epics.trigramme", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("nom", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("date_debut", sa.Date(), nullable=False),
        sa.Column("date_fin", sa.Date(), nullable=False),
        sa.Column("statut", project_status, nullable=False),
        sa.Column(
            "responsable_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_projects_epic_trigramme", "projects", ["epic_trigramme"])

    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "projet_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("nom", sa.String(255), nullable=False),
        sa.Column("date_debut", sa.Date(), nullable=False),
        sa.Column("date_fin", sa.Date(), nullable=False),
        sa.Column("avancement", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "responsable_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("statut", task_status, nullable=False),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "avancement >= 0 AND avancement <= 100", name="ck_task_avancement_range"
        ),
    )
    op.create_index("ix_tasks_projet_id", "tasks", ["projet_id"])

    op.create_table(
        "milestones",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "epic_trigramme",
            sa.String(3),
            sa.ForeignKey("epics.trigramme", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("nom", sa.String(255), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("atteint", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "(epic_trigramme IS NULL) <> (project_id IS NULL)",
            name="ck_milestone_xor_parent",
        ),
    )

    op.create_table(
        "dependencies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tache_amont_id",
            sa.Integer(),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tache_aval_id",
            sa.Integer(),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", dependency_type, nullable=False),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("tache_amont_id <> tache_aval_id", name="ck_dependency_no_self"),
        sa.UniqueConstraint(
            "tache_amont_id", "tache_aval_id", "type", name="uq_dependency_amont_aval_type"
        ),
    )
    op.create_index("ix_dependencies_tache_amont_id", "dependencies", ["tache_amont_id"])
    op.create_index("ix_dependencies_tache_aval_id", "dependencies", ["tache_aval_id"])

    op.create_table(
        "measures",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "epic_trigramme",
            sa.String(3),
            sa.ForeignKey("epics.trigramme", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("valeur", sa.Float(), nullable=False),
        sa.Column("unite", sa.String(50), nullable=False),
        sa.Column("commentaire", sa.Text(), nullable=True),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_measures_epic_trigramme", "measures", ["epic_trigramme"])


def downgrade() -> None:
    op.drop_table("measures")
    op.drop_table("dependencies")
    op.drop_table("milestones")
    op.drop_table("tasks")
    op.drop_table("projects")
    op.drop_table("epics")
    op.drop_table("users")
    for enum_name in (
        "dependency_type",
        "task_status",
        "project_status",
        "epic_category",
        "epic_status",
        "user_role",
    ):
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=True)
