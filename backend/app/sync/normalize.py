import hashlib
import json
from dataclasses import asdict, dataclass

from app.sync.pokeapi import PokeApiPokemon

REQUIRED_STATS = ("hp", "attack", "defense", "special-attack", "special-defense", "speed")
# Mirrors the pokemon table's constraints, so one bad upstream record is skipped and reported
# instead of failing the database write for every Pokémon in the sync.
STAT_RANGE = range(1, 256)
MAX_TYPES = 2


@dataclass(frozen=True)
class PokemonRecord:
    """One Pokémon as the app stores it: exactly the fields we track for changes."""

    id: int
    name: str
    types: tuple[str, ...]
    hp: int
    attack: int
    defense: int
    sp_attack: int
    sp_defense: int
    speed: int
    sprite_url: str | None
    is_default: bool

    def content_hash(self) -> str:
        # Sorted keys and fixed separators give identical bytes for identical data.
        payload = json.dumps(asdict(self), sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(payload.encode()).hexdigest()


def normalize(raw: PokeApiPokemon) -> PokemonRecord:
    stats = {entry.stat.name: entry.base_stat for entry in raw.stats}
    missing = [name for name in REQUIRED_STATS if name not in stats]
    if missing:
        raise ValueError(f"{raw.name} is missing base stats: {', '.join(missing)}")
    out_of_range = [name for name in REQUIRED_STATS if stats[name] not in STAT_RANGE]
    if out_of_range:
        raise ValueError(f"{raw.name} has base stats outside 1-255: {', '.join(out_of_range)}")
    types = tuple(slot.type.name for slot in sorted(raw.types, key=lambda slot: slot.slot))
    if not 1 <= len(types) <= MAX_TYPES:
        raise ValueError(f"{raw.name} has {len(types)} types; expected 1 or {MAX_TYPES}")

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
