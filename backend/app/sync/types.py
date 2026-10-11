"""Plain data passed between the sync's steps: fetch -> normalize -> store -> report."""

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from app.pokemon.enums import PokemonType
from app.pokemon.schemas import EvolutionMethod
from app.sync.enums import ChangeKind
from app.sync.pokeapi import PokeApiEvolutionChain, PokeApiPokemon, PokeApiSpecies, PokeApiType

Clock = Callable[[], datetime]


@dataclass(frozen=True)
class PokemonFetchResult:
    """What one pass over PokéAPI's Pokémon returned."""

    pokemon: list[PokeApiPokemon]
    # Every id in PokéAPI's listing, fetched or not. Only these count as still existing.
    listed_ids: set[int]
    # URLs that still failed after retrying. A failed fetch says nothing about whether the
    # Pokémon still exists, so it must never be treated as a removal.
    failed: list[str]


@dataclass(frozen=True)
class SpeciesFetchResult:
    """What one pass over PokéAPI's species and evolution chains returned."""

    species: list[PokeApiSpecies]
    evolution_chains: list[PokeApiEvolutionChain]
    # URLs that still failed after retrying.
    failed: list[str]


@dataclass(frozen=True)
class TypeFetchResult:
    """What one pass over PokéAPI's types returned."""

    types: list[PokeApiType]
    # URLs that still failed after retrying.
    failed: list[str]


@dataclass(frozen=True)
class SpeciesRecord:
    """A species ready to store: its place in its evolution family and its Pokémon."""

    id: int
    name: str
    # e.g. "Flame Pokémon".
    genus: str | None
    is_legendary: bool
    is_mythical: bool
    evolution_chain_id: int
    evolves_from_species_id: int | None
    # How it evolves from evolves_from_species_id; none for a family's first stage.
    evolution_methods: tuple[EvolutionMethod, ...]
    # Its default form and any alternate forms.
    pokemon_ids: tuple[int, ...]


@dataclass(frozen=True)
class TypeMatchupRecord:
    """How much damage a move of one type does to a Pokémon of another, ready to store."""

    attacking_type: PokemonType
    defending_type: PokemonType
    # One of the type chart's multipliers: 0, 0.5, 1 or 2.
    multiplier: float


@dataclass(frozen=True)
class Change:
    """A change the sync found, with snapshots of the tracked fields."""

    pokemon_id: int
    kind: ChangeKind
    before: dict[str, Any] | None
    after: dict[str, Any] | None


@dataclass(frozen=True)
class StoreResult:
    inserted: int
    updated: int
    unchanged: int
    removed: int
    restored: int
    changes: list[Change] = field(default_factory=list)


@dataclass(frozen=True)
class SyncReport:
    run_id: int
    fetched: int
    inserted: int
    updated: int
    unchanged: int
    removed: int
    restored: int
    # PokéAPI URLs (or names, for unusable data) of Pokémon that couldn't be synced.
    failed: list[str] = field(default_factory=list)
