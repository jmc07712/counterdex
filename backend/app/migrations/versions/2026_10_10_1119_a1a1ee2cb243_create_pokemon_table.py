"""create pokemon table

Revision ID: a1a1ee2cb243
Revises:
Create Date: 2026-10-10 11:19:06.500150

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a1a1ee2cb243"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "pokemon",
        sa.Column("id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("types", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("hp", sa.SmallInteger(), nullable=False),
        sa.Column("attack", sa.SmallInteger(), nullable=False),
        sa.Column("defense", sa.SmallInteger(), nullable=False),
        sa.Column("sp_attack", sa.SmallInteger(), nullable=False),
        sa.Column("sp_defense", sa.SmallInteger(), nullable=False),
        sa.Column("speed", sa.SmallInteger(), nullable=False),
        sa.Column("sprite_url", sa.Text(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("attack between 1 and 255", name=op.f("ck_pokemon_attack_in_range")),
        sa.CheckConstraint(
            "cardinality(types) between 1 and 2", name=op.f("ck_pokemon_one_or_two_types")
        ),
        sa.CheckConstraint("defense between 1 and 255", name=op.f("ck_pokemon_defense_in_range")),
        sa.CheckConstraint("hp between 1 and 255", name=op.f("ck_pokemon_hp_in_range")),
        sa.CheckConstraint(
            "sp_attack between 1 and 255", name=op.f("ck_pokemon_sp_attack_in_range")
        ),
        sa.CheckConstraint(
            "sp_defense between 1 and 255", name=op.f("ck_pokemon_sp_defense_in_range")
        ),
        sa.CheckConstraint("speed between 1 and 255", name=op.f("ck_pokemon_speed_in_range")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pokemon")),
        sa.UniqueConstraint("name", name=op.f("uq_pokemon_name")),
    )


def downgrade() -> None:
    op.drop_table("pokemon")
