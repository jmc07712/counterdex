"""Teams as the API takes and shows them. Descriptions appear in the API docs."""

import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

from app.accounts.constants import USERNAME_PATTERN
from app.core.text import NO_NUL
from app.pokemon.constants import MAX_POKEMON_ID
from app.pokemon.enums import PokemonType
from app.pokemon.schemas import Pokemon, SearchText
from app.teams.constants import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    MAX_TEAM_NAME_LENGTH,
    MAX_TEAM_SIZE,
)
from app.teams.enums import TeamConflictReason

TeamName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_TEAM_NAME_LENGTH),
    NO_NUL,
]
PokemonId = Annotated[int, Field(ge=1, le=MAX_POKEMON_ID)]


def _each_once[T: Sequence[int]](pokemon_ids: T) -> T:
    if len(set(pokemon_ids)) != len(pokemon_ids):
        raise ValueError("Each Pokémon can be on a team only once.")
    return pokemon_ids


PokemonIds = Annotated[list[PokemonId], Field(max_length=MAX_TEAM_SIZE), AfterValidator(_each_once)]


class NewTeam(BaseModel):
    """A team to create: its name, and any Pokémon to start with."""

    model_config = ConfigDict(use_attribute_docstrings=True)

    name: TeamName
    """1 to 40 characters, not counting spaces at either end."""
    pokemon_ids: PokemonIds = Field(default_factory=list)
    """Up to six Pokémon `id`s, in slot order, one from each evolution family."""


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


class TeamPreviewQuery(BaseModel):
    """The Pokémon to preview as a team."""

    model_config = ConfigDict(frozen=True, validate_by_name=True)

    pokemon_ids: Annotated[
        PokemonIds,
        Field(
            alias="pokemon_id",
            description="A Pokémon's `id`. Repeat it for each Pokémon, in slot order, up to six.",
        ),
    ] = Field(default_factory=list)


class TeamsQuery(BaseModel):
    """Which of everyone's teams to list, and which page. A team must match every filter given."""

    model_config = ConfigDict(frozen=True, validate_by_name=True)

    q: Annotated[
        SearchText | None,
        Field(
            description="Part of a team's name, its owner's username or the name of a Pokémon on "
            "it, e.g. `rain` or `char`. Case doesn't matter."
        ),
    ] = None
    types: Annotated[
        tuple[PokemonType, ...],
        Field(
            alias="type",
            max_length=len(PokemonType),
            description="Only teams with a Pokémon of this type. Repeat it "
            "(`type=fire&type=water`) to require one of each, on one Pokémon or different ones.",
        ),
    ] = ()
    changed: Annotated[
        bool,
        Field(
            description="Only teams with a Pokémon a sync has changed in the last week: updated, "
            "removed or listed again."
        ),
    ] = False
    owner: Annotated[
        str | None,
        Field(
            pattern=USERNAME_PATTERN,
            description="Only this user's teams, including any with no Pokémon yet. Case doesn't "
            "matter. A username no one has gives an empty page, not an error.",
        ),
    ] = None
    limit: Annotated[int, Field(ge=1, le=MAX_PAGE_SIZE, description="How many teams per page.")] = (
        DEFAULT_PAGE_SIZE
    )
    cursor: Annotated[
        uuid.UUID | None,
        Field(
            description="Where to continue from: the previous page's `next_cursor`. Leave it out "
            "for the first page."
        ),
    ] = None


class TeamOwner(BaseModel):
    """Who a team belongs to."""

    model_config = ConfigDict(use_attribute_docstrings=True)

    username: str
    """In the case they signed up with."""


class TeamMember(BaseModel):
    """A Pokémon on a team."""

    model_config = ConfigDict(use_attribute_docstrings=True)

    position: int
    """Its slot, from 0."""
    pokemon: Pokemon
    removed_at: datetime | None
    """When PokéAPI stopped listing it, or `null` while it's listed. It stays on the team."""


class Team(BaseModel):
    """A team of up to six Pokémon."""

    model_config = ConfigDict(use_attribute_docstrings=True)

    id: uuid.UUID
    name: str
    owner: TeamOwner
    """The user who made it, and the only one who can change it."""
    created_at: datetime
    updated_at: datetime
    """When the team or its members last changed."""
    members: list[TeamMember]
    """In slot order."""


class TeamPage(BaseModel):
    """One page of teams."""

    model_config = ConfigDict(use_attribute_docstrings=True)

    items: list[Team]
    """This page's teams, newest first."""
    next_cursor: uuid.UUID | None
    """Pass as `cursor` to get the next page; `null` on the last page."""


class TeamConflict(BaseModel):
    """Why the change can't be made to the team as it is now."""

    model_config = ConfigDict(use_attribute_docstrings=True)

    detail: str
    """What's wrong, in a sentence."""
    reason: TeamConflictReason
    """What's wrong, as a code to act on."""
