"""store enums and check pokemon types

Revision ID: d2ec39abf848
Revises: d4bed3f1276a
Create Date: 2026-10-10 13:14:40.963167

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d2ec39abf848"
down_revision: str | Sequence[str] | None = "d4bed3f1276a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Migrations spell values out instead of importing the app's enums: a migration must always
# build the same schema, even after the enums change.
KNOWN_TYPES = (
    "types <@ array['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', "
    "'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', "
    "'fairy']::text[]"
)
KNOWN_STATUS = "status in ('succeeded', 'failed')"
KNOWN_KIND = "kind in ('updated', 'removed', 'restored')"


def upgrade() -> None:
    # VARCHAR is how SQLAlchemy stores enums as text (equivalent to TEXT in Postgres). The status
    # and kind checks are recreated so they're defined against the new type, as in the models.
    op.drop_constraint(op.f("ck_sync_runs_known_status"), "sync_runs", type_="check")
    op.drop_constraint(op.f("ck_pokemon_changes_known_kind"), "pokemon_changes", type_="check")
    op.alter_column(
        "sync_runs", "status", existing_type=sa.Text(), type_=sa.String(), existing_nullable=False
    )
    op.alter_column(
        "pokemon_changes",
        "kind",
        existing_type=sa.Text(),
        type_=sa.String(),
        existing_nullable=False,
    )
    op.create_check_constraint(op.f("ck_sync_runs_known_status"), "sync_runs", KNOWN_STATUS)
    op.create_check_constraint(op.f("ck_pokemon_changes_known_kind"), "pokemon_changes", KNOWN_KIND)
    op.create_check_constraint(op.f("ck_pokemon_known_types"), "pokemon", KNOWN_TYPES)


def downgrade() -> None:
    op.drop_constraint(op.f("ck_pokemon_known_types"), "pokemon", type_="check")
    op.drop_constraint(op.f("ck_pokemon_changes_known_kind"), "pokemon_changes", type_="check")
    op.drop_constraint(op.f("ck_sync_runs_known_status"), "sync_runs", type_="check")
    op.alter_column(
        "pokemon_changes",
        "kind",
        existing_type=sa.String(),
        type_=sa.Text(),
        existing_nullable=False,
    )
    op.alter_column(
        "sync_runs", "status", existing_type=sa.String(), type_=sa.Text(), existing_nullable=False
    )
    op.create_check_constraint(op.f("ck_pokemon_changes_known_kind"), "pokemon_changes", KNOWN_KIND)
    op.create_check_constraint(op.f("ck_sync_runs_known_status"), "sync_runs", KNOWN_STATUS)
