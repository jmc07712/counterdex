"""check a team member's family at commit

Revision ID: 06497710e4c9
Revises: 6eaf84154707
Create Date: 2026-10-11 15:27:10.038869

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "06497710e4c9"
down_revision: str | Sequence[str] | None = "6eaf84154707"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "alter table team_members alter constraint fk_team_members_species_id_species"
        " deferrable initially deferred"
    )


def downgrade() -> None:
    op.execute(
        "alter table team_members alter constraint fk_team_members_species_id_species"
        " not deferrable"
    )
