"""Validated shapes of the PokéAPI responses the sync reads.

Only the fields the app uses are declared; Pydantic ignores the rest (moves, games, etc.).
"""

from pydantic import BaseModel


class NamedResource(BaseModel):
    name: str


class TypeSlot(BaseModel):
    slot: int
    type: NamedResource


class BaseStat(BaseModel):
    base_stat: int
    stat: NamedResource


class Sprites(BaseModel):
    front_default: str | None


class PokeApiPokemon(BaseModel):
    """GET /pokemon/{id}"""

    id: int
    name: str
    is_default: bool
    types: list[TypeSlot]
    stats: list[BaseStat]
    sprites: Sprites


class ListingEntry(BaseModel):
    name: str
    url: str


class PokeApiListing(BaseModel):
    """GET /pokemon?offset=N&limit=M"""

    next: str | None
    results: list[ListingEntry]
