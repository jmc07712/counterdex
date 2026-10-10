"""Turn PokéAPI responses into the Pokémon the app stores."""

import hashlib
import json

from pydantic import ValidationError

from app.pokemon.schemas import Pokemon
from app.sync.constants import POKEAPI_STAT_NAMES
from app.sync.schemas import PokeApiPokemon


def normalize(raw: PokeApiPokemon) -> Pokemon:
    """Raises ValueError, with a one-line reason, for data our table would refuse."""
    base_stats = {entry.stat.name: entry.base_stat for entry in raw.stats}
    try:
        return Pokemon.model_validate(
            {
                "id": raw.id,
                "name": raw.name,
                "types": [slot.type.name for slot in sorted(raw.types, key=lambda slot: slot.slot)],
                # A stat PokéAPI left out is left out here too, and reported as missing.
                "stats": {
                    ours: base_stats[theirs]
                    for ours, theirs in POKEAPI_STAT_NAMES.items()
                    if theirs in base_stats
                },
                "sprite_url": raw.sprites.front_default,
                "is_default": raw.is_default,
            }
        )
    except ValidationError as error:
        # One line per Pokémon in the sync's log, e.g. "stats.speed: Field required".
        reasons = (
            f"{'.'.join(map(str, problem['loc']))}: {problem['msg']}"
            for problem in error.errors(include_url=False)
        )
        raise ValueError("; ".join(reasons)) from error


def content_hash(pokemon: Pokemon) -> str:
    """SHA-256 of a Pokémon's tracked fields; equal data always gives an equal hash."""
    # The table's flat columns with sorted keys and fixed separators: identical data gives
    # identical bytes, the same bytes the hashes already stored were computed from.
    payload = json.dumps(pokemon.to_columns(), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()
