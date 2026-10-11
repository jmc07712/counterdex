"""The type chart and real Pokémon for the counter tests."""

from collections.abc import Mapping
from typing import Any

from sqlalchemy import func, update
from sqlalchemy.orm import Session

from app.counter.types import Fighter, TypeChart
from app.pokemon import models
from app.pokemon.enums import PokemonType
from app.sync.normalize import normalize_type_chart
from app.sync.pokeapi import PokeApiType
from app.sync.store import store_type_chart
from tests.support.pokeapi import type_response
from tests.support.pokemon import add_species, make_pokemon

# The type chart as a sync stores it from the fake PokéAPI.
MATCHUPS = normalize_type_chart(
    PokeApiType.model_validate(type_response(type_)) for type_ in PokemonType
)
TYPE_CHART: TypeChart = {
    (matchup.attacking_type, matchup.defending_type): matchup.multiplier for matchup in MATCHUPS
}

# Real Pokémon's types and base stats (HP, Attack, Defense, Sp. Atk, Sp. Def, Speed), by id.
REAL_POKEMON: Mapping[int, tuple[str, tuple[str, ...], tuple[int, int, int, int, int, int]]] = {
    6: ("charizard", ("fire", "flying"), (78, 84, 78, 109, 85, 100)),
    9: ("blastoise", ("water",), (79, 83, 100, 85, 105, 78)),
    3: ("venusaur", ("grass", "poison"), (80, 82, 83, 100, 100, 80)),
    26: ("raichu", ("electric",), (60, 90, 55, 90, 80, 110)),
    59: ("arcanine", ("fire",), (90, 110, 80, 100, 80, 95)),
    65: ("alakazam", ("psychic",), (55, 50, 45, 135, 95, 120)),
    68: ("machamp", ("fighting",), (90, 130, 80, 65, 85, 55)),
    76: ("golem", ("rock", "ground"), (80, 120, 130, 55, 65, 45)),
    94: ("gengar", ("ghost", "poison"), (60, 65, 60, 130, 75, 110)),
    121: ("starmie", ("water", "psychic"), (60, 75, 85, 100, 85, 115)),
    130: ("gyarados", ("water", "flying"), (95, 125, 79, 60, 100, 81)),
    131: ("lapras", ("water", "ice"), (130, 85, 80, 85, 95, 60)),
    135: ("jolteon", ("electric",), (65, 65, 60, 110, 95, 130)),
    142: ("aerodactyl", ("rock", "flying"), (80, 105, 65, 60, 75, 130)),
    143: ("snorlax", ("normal",), (160, 110, 65, 65, 110, 30)),
    149: ("dragonite", ("dragon", "flying"), (91, 134, 95, 100, 100, 80)),
    145: ("zapdos", ("electric", "flying"), (90, 90, 85, 125, 90, 100)),
    150: ("mewtwo", ("psychic",), (106, 110, 90, 154, 90, 130)),
    151: ("mew", ("psychic",), (100, 100, 100, 100, 100, 100)),
    248: ("tyranitar", ("rock", "dark"), (100, 134, 110, 95, 100, 61)),
}
LEGENDARY = {145, 150}
MYTHICAL = {151}


def real_columns(pokemon_id: int, **overrides: Any) -> dict[str, Any]:
    """A real Pokémon as the pokemon table's columns, less the sync's bookkeeping."""
    name, types, (hp, attack, defense, sp_attack, sp_defense, speed) = REAL_POKEMON[pokemon_id]
    columns: dict[str, Any] = {
        "id": pokemon_id,
        "name": name,
        "types": list(types),
        "hp": hp,
        "attack": attack,
        "defense": defense,
        "sp_attack": sp_attack,
        "sp_defense": sp_defense,
        "speed": speed,
        "sprite_url": None,
        "is_default": True,
    }
    return columns | overrides


def add_type_chart(session: Session) -> None:
    """Stores the type chart, as a sync would."""
    store_type_chart(session, MATCHUPS)


def add_real_pokemon(session: Session, *ids: int) -> None:
    """Saves these real Pokémon, each the only one of its own species and family (family 1000 +
    id), marked legendary or mythical as in the games.
    """
    session.add_all(make_pokemon(**real_columns(pokemon_id)) for pokemon_id in ids)
    session.flush()
    for pokemon_id in ids:
        add_species(
            session,
            pokemon_id,
            family=1000 + pokemon_id,
            pokemon_ids=[pokemon_id],
            is_legendary=pokemon_id in LEGENDARY,
            is_mythical=pokemon_id in MYTHICAL,
        )


def remove_pokemon(session: Session, pokemon_id: int) -> None:
    """Marks the Pokémon as no longer listed by PokéAPI, as a sync would."""
    session.execute(
        update(models.Pokemon).where(models.Pokemon.id == pokemon_id).values(removed_at=func.now())
    )


def fighter(**stats: Any) -> Fighter:
    """A Pokémon as the battle model sees it: Normal, with 100 in every stat at level 50 and 100
    speed, unless told otherwise.
    """
    defaults: dict[str, Any] = {
        "id": 1,
        "types": (PokemonType.NORMAL,),
        "hp": 100,
        "attack": 100,
        "defense": 100,
        "sp_attack": 100,
        "sp_defense": 100,
        "speed": 100,
    }
    return Fighter(**(defaults | stats))
