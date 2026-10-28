"""Dépendance « fin de projet → tâche » (`dependencies.projet_amont_id`).

Revision ID: 0014
Revises: 0013
Create Date: 2026-10-28

Demande #141 : qu'une tâche puisse attendre l'achèvement d'un projet ENTIER, et
non d'une tâche précise de ce projet. Le prédécesseur d'une dépendance devient
donc soit une tâche (`tache_amont_id`), soit un projet (`projet_amont_id`) —
exactement l'un des deux, ce que la base vérifie elle-même.

Même table plutôt qu'une table à part : le planning identifie chaque flèche par
l'id de la dépendance ; deux tables auraient deux séquences d'ids, donc des
collisions dans la même vue.

Un lien de projet est toujours `FS` : c'est la FIN du projet qui est attendue.

`ondelete="CASCADE"` comme pour les tâches : supprimer le projet amont retire
le lien, qui ne désignerait plus rien.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("dependencies", sa.Column("projet_amont_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "dependencies_projet_amont_id_fkey",
        "dependencies",
        "projects",
        ["projet_amont_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_dependencies_projet_amont_id", "dependencies", ["projet_amont_id"])
    op.alter_column("dependencies", "tache_amont_id", existing_type=sa.Integer(), nullable=True)
    op.create_check_constraint(
        "ck_dependency_amont_unique",
        "dependencies",
        "(tache_amont_id IS NULL) <> (projet_amont_id IS NULL)",
    )
    op.create_check_constraint(
        "ck_dependency_projet_fs",
        "dependencies",
        "projet_amont_id IS NULL OR type = 'FS'",
    )
    op.create_unique_constraint(
        "uq_dependency_projet_aval", "dependencies", ["projet_amont_id", "tache_aval_id"]
    )


def downgrade() -> None:
    # Les liens de projet n'ont pas d'équivalent dans l'ancien schéma : les
    # garder violerait le NOT NULL rétabli sur `tache_amont_id`.
    op.execute("DELETE FROM dependencies WHERE projet_amont_id IS NOT NULL")
    op.drop_constraint("uq_dependency_projet_aval", "dependencies", type_="unique")
    op.drop_constraint("ck_dependency_projet_fs", "dependencies", type_="check")
    op.drop_constraint("ck_dependency_amont_unique", "dependencies", type_="check")
    op.alter_column("dependencies", "tache_amont_id", existing_type=sa.Integer(), nullable=False)
    op.drop_index("ix_dependencies_projet_amont_id", table_name="dependencies")
    op.drop_constraint("dependencies_projet_amont_id_fkey", "dependencies", type_="foreignkey")
    op.drop_column("dependencies", "projet_amont_id")
