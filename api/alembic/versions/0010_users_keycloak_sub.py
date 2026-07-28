"""Users : pont vers Keycloak (`keycloak_sub`).

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-28

L'adossement à Keycloak ne remplace pas la table `users` : les
colonnes `projects.responsable_id` et `tasks.responsable_id` sont des clés
étrangères vers `users.id`. Le compte local doit donc survivre — seul le moyen
de l'identifier change.

On ajoute le `sub` du jeton Keycloak (UUID) comme pont. C'est un identifiant
**stable**, contrairement à l'email, qui peut être modifié dans le realm : s'y
fier casserait le lien au premier changement d'adresse.

Nullable et unique :
- **nullable**, parce que les comptes existants (dont l'admin de seed) n'ont pas
  encore de `sub` — il leur sera attribué à leur première connexion OIDC, par
  rapprochement sur l'email ;
- **unique**, parce que deux comptes locaux ne peuvent pas désigner le même
  utilisateur Keycloak. PostgreSQL autorise plusieurs NULL dans un index unique,
  les comptes non encore liés ne se gênent donc pas entre eux.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("keycloak_sub", sa.String(length=36), nullable=True))
    op.create_index("ix_users_keycloak_sub", "users", ["keycloak_sub"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_keycloak_sub", table_name="users")
    op.drop_column("users", "keycloak_sub")
