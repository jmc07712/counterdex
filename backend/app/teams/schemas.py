"""Teams as the API takes and shows them. Descriptions appear in the API docs."""

import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

from app.pokemon.constants import MAX_POKEMON_ID
from app.pokemon.schemas import Pokemon
from app.teams.constants import MAX_TEAM_NAME_LENGTH, MAX_TEAM_SIZE
from app.teams.enums import TeamConflictReason

TeamName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_TEAM_NAME_LENGTH),
]
PokemonId = Annotated[int, Field(ge=1, le=MAX_POKEMON_ID)]


def _each_once[T: Sequence[int]](pokemon_ids: T) -> T:
    if len(set(pokemon_ids)) != len(pokemon_ids):
        raise ValueError("Each Pokémon can be given once.")
    return pokemon_ids


PokemonIds = Annotated[list[PokemonId], Field(max_length=MAX_TEAM_SIZE), AfterValidator(_each_once)]


class NewTeam(BaseModel):
    """A team to create: its name, and any Pokémon to start with."""

    model_config = ConfigDict(use_attribute_docstrings=True)

    name: TeamName
    """1 to 40 characters, not counting spaces at either end."""
    pokemon_ids: PokemonIds = Field(default_factory=list)
    """Up to six Pokémon `id`s, in slot order, one of each species."""


class TeamRename(BaseModel):
    """A team's new name."""

    model_config = ConfigDict(use_attribute_docstrings=True)

    name: TeamName
    """1 to 40 characters, not counting spaces at either end."""


class NewMember(BaseModel):
    """A Pokémon to put on a team."""

    model_config = ConfigDict(use_attribute_docstrings=True)

    pokemon_id: PokemonId
    """The Pokémon's `id`."""


class TeamOrder(BaseModel):
    """A team's members in a new order."""

    model_config = ConfigDict(use_attribute_docstrings=True)

    pokemon_ids: PokemonIds
    """Every member's Pokémon `id`, each once, in the new slot order."""


class TeamMember(BaseModel):
    """A Pokémon on a team."""

    model_config = ConfigDict(use_attribute_docstrings=True)

    position: int
    """Its slot, from 0."""
    pokemon: Pokemon
    removed_at: datetime | None
    """When PokéAPI stopped listing it, or `null` while it's listed. It stays on the team."""
    related_pokemon_ids: list[int]
    """The other members that are an earlier or later stage of its evolution line, such as
    Charmander for Charizard. Branches of one family, such as Vaporeon and Jolteon, aren't."""


class Team(BaseModel):
    """A team of up to six Pokémon."""

    model_config = ConfigDict(use_attribute_docstrings=True)

    id: uuid.UUID
    name: str
    created_at: datetime
    updated_at: datetime
    """When the team or its members last changed."""
    members: list[TeamMember]
    """In slot order."""


class TeamConflict(BaseModel):
    """Why the change can't be made to the team as it is now."""

    reason: TeamConflictReason
