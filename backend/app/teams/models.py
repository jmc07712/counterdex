import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Identity,
    Index,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.teams.constants import MAX_TEAM_NAME_LENGTH, MAX_TEAM_SIZE


class Team(Base):
    """A user's team of up to six Pokémon, in order."""

    __tablename__ = "teams"
    __table_args__ = (
        CheckConstraint(
            f"char_length(name) between 1 and {MAX_TEAM_NAME_LENGTH}", name="name_length"
        ),
        # A user's teams, listed most recently changed first.
        Index("ix_teams_user_id_updated_at", "user_id", "updated_at"),
    )

    # Chosen by the client, so a create that's sent twice makes one team.
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Set by every change to the team or its members.
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TeamMember(Base):
    """A Pokémon on a team, in its slot. A team's slots run from 0 with no gaps."""

    __tablename__ = "team_members"
    __table_args__ = (
        # With the unique slot below, this keeps a team to six members.
        CheckConstraint(f"position between 0 and {MAX_TEAM_SIZE - 1}", name="position_in_team"),
        # Checked when the transaction commits, so members can pass through each other's slots
        # while they're reordered.
        UniqueConstraint(
            "team_id",
            "position",
            name="uq_team_members_team_id_position",
            deferrable=True,
            initially="DEFERRED",
        ),
        # One of each species: Charizard and Mega Charizard X can't share a team.
        UniqueConstraint("team_id", "species_id", name="uq_team_members_team_id_species_id"),
        # The species is this Pokémon's. If PokéAPI moves a Pokémon to another species, its
        # slots follow.
        ForeignKeyConstraint(
            ["pokemon_id", "species_id"],
            ["species_varieties.pokemon_id", "species_varieties.species_id"],
            name="fk_team_members_pokemon_id_species_varieties",
            onupdate="CASCADE",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(SmallInteger)
    pokemon_id: Mapped[int]
    species_id: Mapped[int]
