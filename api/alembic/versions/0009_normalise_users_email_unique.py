"""Users.email : normaliser l'unicité en un seul index unique.

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-22

La migration 0001 avait posé DEUX objets pour l'email : une contrainte unique
(`users_email_key`, via `Column(unique=True)`) ET un index non unique
(`ix_users_email`). C'est redondant, et ça divergeait du modèle, qui déclare
`unique=True, index=True` — soit un unique index unique nommé `ix_users_email`.

On aligne la base sur le modèle : on retire la contrainte et l'index non unique,
et on crée l'index unique `ix_users_email`. `alembic check` redevient vert.
Les emails sont déjà uniques (la contrainte existait), la création de l'index
unique ne peut donc pas échouer sur les données en place.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("users_email_key", "users", type_="unique")
    op.drop_index("ix_users_email", table_name="users")
    op.create_index("ix_users_email", "users", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users")
    op.create_index("ix_users_email", "users", ["email"])
    op.create_unique_constraint("users_email_key", "users", ["email"])
