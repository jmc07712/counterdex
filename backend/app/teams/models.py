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
from app.pokemon.constants import MAX_TEAM_SIZE
from app.teams.constants import MAX_TEAM_NAME_LENGTH

# The names of TeamMember's unique constraints, which the service refers to.
SLOT = "uq_team_members_team_id_position"
FAMILY_ON_TEAM = "uq_team_members_team_id_family_id"


class Team(Base):
    """A user's team of up to six Pokémon, in order."""

    __tablename__ = "teams"
    __table_args__ = (
        CheckConstraint(
            f"char_length(name) between 1 and {MAX_TEAM_NAME_LENGTH}", name="name_length"
        ),
        # A user's teams, listed most recently changed first.
        Index("ix_teams_user_id_updated_at", "user_id", "updated_at"),
        # Everyone's teams, listed newest first, a page at a time.
        Index("ix_teams_created_at_id", "created_at", "id"),
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
        UniqueConstraint("team_id", "position", name=SLOT, deferrable=True, initially="DEFERRED"),
        # One Pokémon from each evolution family: Charmander, Charizard and Mega Charizard X
        # can't share a team. This also keeps a team to one of each species. A sync that would
        # put two Pokémon from one family on a team fails here, and the whole sync is rolled
        # back.
        UniqueConstraint("team_id", "family_id", name=FAMILY_ON_TEAM),
        # The species is this Pokémon's. When a sync moves a Pokémon to another species, its
        # members' species_id changes with it.
        ForeignKeyConstraint(
            ["pokemon_id", "species_id"],
            ["species_varieties.pokemon_id", "species_varieties.species_id"],
            name="fk_team_members_pokemon_id_species_varieties",
            onupdate="CASCADE",
        ),
        # The family is this species'. When a sync moves a species to another family, its
        # members' family_id changes with it. Checked when the transaction commits, so a member
        # whose Pokémon moved to a species in another family can be moved to that family before
        # then.
        ForeignKeyConstraint(
            ["species_id", "family_id"],
            ["species.id", "species.evolution_chain_id"],
            name="fk_team_members_species_id_species",
            onupdate="CASCADE",
            deferrable=True,
            initially="DEFERRED",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(SmallInteger)
    pokemon_id: Mapped[int]
    species_id: Mapped[int]
    # The species' evolution_chain_id.
    family_id: Mapped[int]
