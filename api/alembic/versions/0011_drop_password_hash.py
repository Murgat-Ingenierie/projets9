"""Users : suppression de `password_hash`.

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-29

Avec le retrait de `POST /api/auth/login`, plus aucun code ne lit cette colonne :
l'authentification se fait entièrement chez Keycloak. Ce qui reste en base, ce
sont des empreintes bcrypt de mots de passe qui n'ouvrent plus rien.

On les supprime plutôt que de les laisser dormir. Un secret qui ne sert plus
n'est pas neutre : il continue de fuiter si la base fuit, et les gens réutilisent
leurs mots de passe ailleurs. La seule façon de ne pas divulguer une donnée est
de ne pas la détenir.

**Destructif et assumé** : la migration inverse recrée la colonne, pas son
contenu. Elle la pose `NOT NULL DEFAULT ''` — un revenir-en-arrière rendrait de
toute façon tous les comptes inconnectables par mot de passe, ce qui est exact :
il n'y a plus de mot de passe à connaître.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("users", "password_hash")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_hash", sa.String(length=255), nullable=False, server_default=""),
    )
