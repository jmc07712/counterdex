"""Plain data passed between the sync's steps: fetch -> normalize -> store -> report."""

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from app.pokemon.schemas import EvolutionMethod
from app.sync.enums import ChangeKind
from app.sync.pokeapi import PokeApiEvolutionChain, PokeApiPokemon, PokeApiSpecies

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
class SpeciesRecord:
    """A species ready to store: its place in its evolution family and its Pokémon."""

    id: int
    name: str
    # e.g. "Flame Pokémon".
    genus: str | None
    evolution_chain_id: int
    evolves_from_species_id: int | None
    # How it evolves from evolves_from_species_id; none for a family's first stage.
    evolution_methods: tuple[EvolutionMethod, ...]
    # Its default form and any alternate forms.
    pokemon_ids: tuple[int, ...]


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
