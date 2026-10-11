"""store each type's damage against the others

Revision ID: 1f8216da36fa
Revises: 06497710e4c9
Create Date: 2026-10-11 15:47:39.178935

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1f8216da36fa"
down_revision: str | Sequence[str] | None = "06497710e4c9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Migrations spell values out instead of importing the app's enums: a migration must always
# build the same schema, even after the enums change.
TYPES = (
    "'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', "
    "'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy'"
)


def upgrade() -> None:
    # VARCHAR is how SQLAlchemy stores enums as text (equivalent to TEXT in Postgres).
    op.create_table(
        "type_matchups",
        sa.Column("attacking_type", sa.String(), nullable=False),
        sa.Column("defending_type", sa.String(), nullable=False),
        sa.Column("multiplier", sa.Double(), nullable=False),
        sa.CheckConstraint(
            f"attacking_type in ({TYPES})", name=op.f("ck_type_matchups_known_attacking_type")
        ),
        sa.CheckConstraint(
            f"defending_type in ({TYPES})", name=op.f("ck_type_matchups_known_defending_type")
        ),
        sa.CheckConstraint(
            "multiplier in (0.0, 0.5, 1.0, 2.0)", name=op.f("ck_type_matchups_known_multiplier")
        ),
        sa.PrimaryKeyConstraint("attacking_type", "defending_type", name=op.f("pk_type_matchups")),
    )


def downgrade() -> None:
    op.drop_table("type_matchups")
