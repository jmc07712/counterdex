"""Plain data passed between the sync's steps: fetch -> normalize -> store -> report."""

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from app.sync.schemas import PokeApiPokemon

Clock = Callable[[], datetime]
ChangeKind = Literal["updated", "removed", "restored"]


@dataclass
class FetchResult:
    """What one pass over PokéAPI returned. Filled in as concurrent fetches finish."""

    pokemon: list[PokeApiPokemon] = field(default_factory=list)
    # Every id in PokéAPI's listing, fetched or not. Only these count as still existing.
    listed_ids: set[int] = field(default_factory=set)
    # URLs that still failed after retrying. A failed fetch says nothing about whether the
    # Pokémon still exists, so it must never be treated as a removal.
    failed: list[str] = field(default_factory=list)


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
