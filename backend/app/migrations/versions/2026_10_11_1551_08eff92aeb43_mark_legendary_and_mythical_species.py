"""mark legendary and mythical species

Revision ID: 08eff92aeb43
Revises: 1f8216da36fa
Create Date: 2026-10-11 15:51:02.992248

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "08eff92aeb43"
down_revision: str | Sequence[str] | None = "1f8216da36fa"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Species stored before now are neither until the next sync fills them in. The defaults
    # only fill existing rows: the sync always writes both.
    for column in ("is_legendary", "is_mythical"):
        op.add_column(
            "species",
            sa.Column(column, sa.Boolean(), server_default=sa.false(), nullable=False),
        )
        op.alter_column("species", column, server_default=None)


def downgrade() -> None:
    op.drop_column("species", "is_mythical")
    op.drop_column("species", "is_legendary")
