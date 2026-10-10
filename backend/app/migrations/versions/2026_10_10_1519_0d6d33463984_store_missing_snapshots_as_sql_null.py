"""store missing change snapshots as sql null

Revision ID: 0d6d33463984
Revises: afdb66512192
Create Date: 2026-10-10 15:19:07.381411

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0d6d33463984"
down_revision: str | Sequence[str] | None = "afdb66512192"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Earlier syncs stored a missing snapshot (a removal's `after`) as JSON's null, which
    # `after is null` doesn't match.
    for column in ("before", "after"):
        op.execute(f"update pokemon_changes set {column} = null where {column} = 'null'::jsonb")


def downgrade() -> None:
    # Nothing to undo: SQL NULL means the same as the JSON null it replaced.
    pass
