"""Validated shapes of the PokéAPI responses the sync reads.

Only the fields the app uses are declared; Pydantic ignores the rest (moves, games, etc.).
"""

from typing import Any
from urllib.parse import urlsplit

from pydantic import BaseModel, field_validator, model_validator

from app.pokemon.schemas import EvolutionMethod
from app.sync.constants import POKEAPI_GENDERS, POKEAPI_RELATIVE_PHYSICAL_STATS


class NamedResource(BaseModel):
    name: str


class ApiResource(BaseModel):
    """A link to another PokéAPI resource, e.g. https://pokeapi.co/api/v2/evolution-chain/2/."""

    url: str

    @field_validator("url")
    @classmethod
    def ends_in_an_id(cls, url: str) -> str:
        if not _last_segment(url).isdigit():
            raise ValueError(f"has no id: {url}")
        return url

    @property
    def id(self) -> int:
        """The id the URL ends in: 2 for https://pokeapi.co/api/v2/evolution-chain/2/."""
        return int(_last_segment(self.url))


class NamedApiResource(ApiResource):
    name: str


# --- GET /pokemon ---


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


class PokeApiListing(BaseModel):
    """GET /pokemon (or /pokemon-species)?offset=N&limit=M"""

    next: str | None
    results: list[NamedApiResource]


# --- GET /pokemon-species ---


class Genus(BaseModel):
    genus: str
    language: NamedResource


class Variety(BaseModel):
    pokemon: NamedApiResource


class PokeApiSpecies(BaseModel):
    """GET /pokemon-species/{id}"""

    id: int
    name: str
    # e.g. "Flame Pokémon", once per language.
    genera: list[Genus]
    evolution_chain: ApiResource
    # The species' Pokémon: its default form and any alternate forms.
    varieties: list[Variety]


# --- GET /evolution-chain ---


class EvolutionDetail(BaseModel):
    """One way a species evolves, from an evolution chain, read into the app's terms."""

    # True for the ways that work in the latest games; older games' ways are listed too.
    is_default: bool = False
    method: EvolutionMethod

    @model_validator(mode="before")
    @classmethod
    def read_method(cls, detail: Any) -> Any:
        """PokéAPI lists the method's trigger and conditions beside `is_default`, linking to
        named things, e.g. "item": {"name": "thunder-stone", "url": ...}, and using ids.
        """
        if not isinstance(detail, dict):
            return detail
        names = {
            key: value["name"] if isinstance(value, dict) and "name" in value else value
            for key, value in detail.items()
        }
        gender = detail.get("gender")
        physical_stats = detail.get("relative_physical_stats")
        chance = (detail.get("condition_expression") or {}).get("percentage_chance")
        return {
            "is_default": detail.get("is_default", False),
            "method": names
            | {
                # "" means any time of day.
                "time_of_day": detail.get("time_of_day") or None,
                # An id we don't know yet is passed on as is, so it fails validation.
                "gender": None if gender is None else POKEAPI_GENDERS.get(gender, gender),
                "relative_physical_stats": None
                if physical_stats is None
                else POKEAPI_RELATIVE_PHYSICAL_STATS.get(physical_stats, physical_stats),
                "chance": chance,
            },
        }


class ChainLink(BaseModel):
    """A species in an evolution chain: how it evolves from the link above, and what it evolves
    into next.
    """

    species: NamedApiResource
    evolution_details: list[EvolutionDetail]
    evolves_to: list["ChainLink"]


class PokeApiEvolutionChain(BaseModel):
    """GET /evolution-chain/{id}: a family of species, from its first stage."""

    id: int
    chain: ChainLink


# --- GET /type ---


class DamageRelations(BaseModel):
    """The types a type's moves do double, half or no damage to. The types they do normal
    damage to aren't listed.
    """

    double_damage_to: list[NamedResource]
    half_damage_to: list[NamedResource]
    no_damage_to: list[NamedResource]


class PokeApiType(BaseModel):
    """GET /type/{name}"""

    id: int
    name: str
    damage_relations: DamageRelations


def _last_segment(url: str) -> str:
    return urlsplit(url).path.rstrip("/").rsplit("/", 1)[-1]
