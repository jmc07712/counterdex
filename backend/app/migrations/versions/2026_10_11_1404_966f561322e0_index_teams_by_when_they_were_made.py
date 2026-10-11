"""index teams by when they were made

Revision ID: 966f561322e0
Revises: b76ea5d3ebc5
Create Date: 2026-10-11 14:04:23.305269

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "966f561322e0"
down_revision: str | Sequence[str] | None = "b76ea5d3ebc5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_teams_created_at_id", "teams", ["created_at", "id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_teams_created_at_id", table_name="teams")
