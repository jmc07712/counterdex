"""Turn PokéAPI responses into the records the app stores."""

import hashlib
import json
from dataclasses import asdict

from app.pokemon.constants import MAX_BASE_STAT, MAX_TYPES, MIN_BASE_STAT, MIN_TYPES
from app.sync.constants import POKEAPI_STAT_NAMES
from app.sync.schemas import PokeApiPokemon
from app.sync.types import PokemonRecord


def normalize(raw: PokeApiPokemon) -> PokemonRecord:
    """Raises ValueError for data our table would refuse, so it can be skipped and reported."""
    stats = {entry.stat.name: entry.base_stat for entry in raw.stats}
    missing = [name for name in POKEAPI_STAT_NAMES if name not in stats]
    if missing:
        raise ValueError(f"{raw.name} is missing base stats: {', '.join(missing)}")
    out_of_range = [
        name for name in POKEAPI_STAT_NAMES if not MIN_BASE_STAT <= stats[name] <= MAX_BASE_STAT
    ]
    if out_of_range:
        raise ValueError(
            f"{raw.name} has base stats outside {MIN_BASE_STAT}-{MAX_BASE_STAT}: "
            f"{', '.join(out_of_range)}"
        )
    types = tuple(slot.type.name for slot in sorted(raw.types, key=lambda slot: slot.slot))
    if not MIN_TYPES <= len(types) <= MAX_TYPES:
        raise ValueError(f"{raw.name} has {len(types)} types; expected {MIN_TYPES}-{MAX_TYPES}")

    return PokemonRecord(
        id=raw.id,
        name=raw.name,
        types=types,
        hp=stats["hp"],
        attack=stats["attack"],
        defense=stats["defense"],
        sp_attack=stats["special-attack"],
        sp_defense=stats["special-defense"],
        speed=stats["speed"],
        sprite_url=raw.sprites.front_default,
        is_default=raw.is_default,
    )


def content_hash(record: PokemonRecord) -> str:
    """SHA-256 of a record's tracked fields; equal data always gives an equal hash."""
    # Sorted keys and fixed separators give identical bytes for identical data.
    payload = json.dumps(asdict(record), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()
