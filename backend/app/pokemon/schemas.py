"""A Pokémon's data, defined once: the sync builds it from PokéAPI, the table stores it and the
API serves it. Descriptions are written for API users; they appear in the docs.
"""

from collections.abc import Mapping
from typing import Annotated, Any, Self

from pydantic import BaseModel, ConfigDict, Field

from app.pokemon.constants import MAX_BASE_STAT, MAX_TYPES, MIN_BASE_STAT, MIN_TYPES

BaseStat = Annotated[int, Field(ge=MIN_BASE_STAT, le=MAX_BASE_STAT)]


class Stats(BaseModel):
    """A Pokémon's base stats, each from 1 to 255."""

    model_config = ConfigDict(frozen=True)

    hp: BaseStat
    attack: BaseStat
    defense: BaseStat
    sp_attack: BaseStat
    sp_defense: BaseStat
    speed: BaseStat


# The pokemon table gives each stat its own column, named after these fields.
STAT_NAMES = tuple(Stats.model_fields)


# The sync detects changes by hashing exactly these fields, so adding one changes every stored
# hash and the next sync records every Pokémon as updated (a pinned-hash test guards this).
class Pokemon(BaseModel):
    """A Pokémon: its Pokédex number, name, types, base stats and sprite."""

    model_config = ConfigDict(frozen=True)

    id: Annotated[
        int, Field(description="Pokédex number. Alternate forms are numbered from 10001.")
    ]
    name: Annotated[str, Field(description="Lowercase and hyphenated, e.g. `charizard-mega-x`.")]
    types: Annotated[
        tuple[str, ...],
        Field(
            min_length=MIN_TYPES,
            max_length=MAX_TYPES,
            description="One or two types, primary type first.",
        ),
    ]
    stats: Stats
    sprite_url: Annotated[
        str | None, Field(description="Front-facing sprite image, or `null` if there isn't one.")
    ]
    is_default: Annotated[
        bool,
        Field(
            description="`false` for alternate forms, such as Mega Evolutions and regional forms."
        ),
    ]

    @classmethod
    def from_columns(cls, columns: Mapping[Any, Any]) -> Self:
        """Read a Pokémon from the pokemon table's columns, ignoring the sync's bookkeeping."""
        fields = {name: columns[name] for name in cls.model_fields if name != "stats"}
        stats = {name: columns[name] for name in STAT_NAMES}
        return cls.model_validate(fields | {"stats": stats})

    def to_columns(self) -> dict[str, Any]:
        """The Pokémon as the pokemon table's columns, as plain JSON-ready values."""
        return self.model_dump(mode="json", exclude={"stats"}) | self.stats.model_dump(mode="json")


class PokemonPage(BaseModel):
    """One page of Pokémon."""

    items: Annotated[list[Pokemon], Field(description="This page's Pokémon, in Pokédex order.")]
    next_cursor: Annotated[
        int | None,
        Field(description="Pass as `cursor` to get the next page; `null` on the last page."),
    ]
