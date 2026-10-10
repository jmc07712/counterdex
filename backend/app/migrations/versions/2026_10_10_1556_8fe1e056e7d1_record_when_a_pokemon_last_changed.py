"""record when a sync last changed a pokemon

Revision ID: 8fe1e056e7d1
Revises: 0d6d33463984
Create Date: 2026-10-10 15:56:34.178165

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8fe1e056e7d1"
down_revision: str | Sequence[str] | None = "0d6d33463984"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "pokemon", sa.Column("last_changed_at", sa.DateTime(timezone=True), nullable=True)
    )
    # Earlier syncs recorded their changes, so each Pokémon last changed at its latest one.
    op.execute(
        """
        update pokemon set last_changed_at = latest.detected_at
        from (
            select pokemon_id, max(detected_at) as detected_at
            from pokemon_changes
            group by pokemon_id
        ) as latest
        where pokemon.id = latest.pokemon_id
        """
    )


def downgrade() -> None:
    op.drop_column("pokemon", "last_changed_at")
