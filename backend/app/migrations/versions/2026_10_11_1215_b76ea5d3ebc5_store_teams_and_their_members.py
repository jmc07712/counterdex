"""store teams and their members

Revision ID: b76ea5d3ebc5
Revises: f76d0c3a5a9c
Create Date: 2026-10-11 12:15:25.712056

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b76ea5d3ebc5"
down_revision: str | Sequence[str] | None = "f76d0c3a5a9c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_species_varieties_pokemon_id_species_id",
        "species_varieties",
        ["pokemon_id", "species_id"],
    )
    op.create_table(
        "teams",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("char_length(name) between 1 and 40", name=op.f("ck_teams_name_length")),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_teams_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_teams")),
    )
    op.create_index("ix_teams_user_id_updated_at", "teams", ["user_id", "updated_at"], unique=False)
    op.create_table(
        "team_members",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("pokemon_id", sa.Integer(), nullable=False),
        sa.Column("species_id", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "position between 0 and 5", name=op.f("ck_team_members_position_in_team")
        ),
        sa.ForeignKeyConstraint(
            ["pokemon_id", "species_id"],
            ["species_varieties.pokemon_id", "species_varieties.species_id"],
            name="fk_team_members_pokemon_id_species_varieties",
            onupdate="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["team_id"],
            ["teams.id"],
            name=op.f("fk_team_members_team_id_teams"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_team_members")),
        sa.UniqueConstraint(
            "team_id",
            "position",
            deferrable=True,
            initially="DEFERRED",
            name="uq_team_members_team_id_position",
        ),
        sa.UniqueConstraint("team_id", "species_id", name="uq_team_members_team_id_species_id"),
    )


def downgrade() -> None:
    op.drop_table("team_members")
    op.drop_index("ix_teams_user_id_updated_at", table_name="teams")
    op.drop_table("teams")
    op.drop_constraint(
        "uq_species_varieties_pokemon_id_species_id", "species_varieties", type_="unique"
    )
