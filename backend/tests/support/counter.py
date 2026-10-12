"""The type chart and real Pokémon for the counter tests."""

from collections.abc import Mapping
from typing import Any, NamedTuple

from sqlalchemy.orm import Session

from app.counter.types import Profile, TypeChart
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


class RealPokemon(NamedTuple):
    name: str
    types: tuple[str, ...]
    # HP, Attack, Defense, Sp. Atk, Sp. Def and Speed.
    stats: tuple[int, int, int, int, int, int]
    # PokéAPI's evolution chain.
    family: int


# Real Pokémon, as PokéAPI has them, by id.
REAL_POKEMON: Mapping[int, RealPokemon] = {
    3: RealPokemon("venusaur", ("grass", "poison"), (80, 82, 83, 100, 100, 80), 1),
    6: RealPokemon("charizard", ("fire", "flying"), (78, 84, 78, 109, 85, 100), 2),
    9: RealPokemon("blastoise", ("water",), (79, 83, 100, 85, 105, 78), 3),
    25: RealPokemon("pikachu", ("electric",), (35, 55, 40, 50, 50, 90), 10),
    26: RealPokemon("raichu", ("electric",), (60, 90, 55, 90, 80, 110), 10),
    36: RealPokemon("clefable", ("fairy",), (95, 70, 73, 95, 90, 60), 14),
    39: RealPokemon("jigglypuff", ("normal", "fairy"), (115, 45, 20, 45, 25, 20), 16),
    59: RealPokemon("arcanine", ("fire",), (90, 110, 80, 100, 80, 95), 25),
    65: RealPokemon("alakazam", ("psychic",), (55, 50, 45, 135, 95, 120), 27),
    68: RealPokemon("machamp", ("fighting",), (90, 130, 80, 65, 85, 55), 28),
    76: RealPokemon("golem", ("rock", "ground"), (80, 120, 130, 55, 65, 45), 31),
    91: RealPokemon("cloyster", ("water", "ice"), (50, 95, 180, 85, 45, 70), 39),
    94: RealPokemon("gengar", ("ghost", "poison"), (60, 65, 60, 130, 75, 110), 40),
    121: RealPokemon("starmie", ("water", "psychic"), (60, 75, 85, 100, 85, 115), 56),
    130: RealPokemon("gyarados", ("water", "flying"), (95, 125, 79, 60, 100, 81), 64),
    131: RealPokemon("lapras", ("water", "ice"), (130, 85, 80, 85, 95, 60), 65),
    135: RealPokemon("jolteon", ("electric",), (65, 65, 60, 110, 95, 130), 67),
    142: RealPokemon("aerodactyl", ("rock", "flying"), (80, 105, 65, 60, 75, 130), 71),
    143: RealPokemon("snorlax", ("normal",), (160, 110, 65, 65, 110, 30), 72),
    145: RealPokemon("zapdos", ("electric", "flying"), (90, 90, 85, 125, 90, 100), 74),
    149: RealPokemon("dragonite", ("dragon", "flying"), (91, 134, 95, 100, 100, 80), 76),
    150: RealPokemon("mewtwo", ("psychic",), (106, 110, 90, 154, 90, 130), 77),
    151: RealPokemon("mew", ("psychic",), (100, 100, 100, 100, 100, 100), 78),
    176: RealPokemon("togetic", ("fairy", "flying"), (55, 40, 85, 80, 105, 40), 87),
    197: RealPokemon("umbreon", ("dark",), (95, 65, 110, 60, 130, 65), 67),
    212: RealPokemon("scizor", ("bug", "steel"), (70, 130, 100, 55, 80, 65), 58),
    227: RealPokemon("skarmory", ("steel", "flying"), (65, 80, 140, 40, 70, 70), 117),
    230: RealPokemon("kingdra", ("water", "dragon"), (75, 95, 95, 95, 95, 85), 54),
    242: RealPokemon("blissey", ("normal",), (255, 10, 10, 75, 135, 55), 51),
    248: RealPokemon("tyranitar", ("rock", "dark"), (100, 134, 110, 95, 100, 61), 126),
    260: RealPokemon("swampert", ("water", "ground"), (100, 110, 90, 85, 90, 60), 132),
    282: RealPokemon("gardevoir", ("psychic", "fairy"), (68, 65, 65, 125, 115, 80), 140),
    373: RealPokemon("salamence", ("dragon", "flying"), (95, 135, 80, 110, 80, 100), 191),
    376: RealPokemon("metagross", ("steel", "psychic"), (80, 135, 130, 95, 90, 70), 192),
    445: RealPokemon("garchomp", ("dragon", "ground"), (108, 130, 95, 80, 85, 102), 230),
    448: RealPokemon("lucario", ("fighting", "steel"), (70, 110, 70, 115, 70, 90), 232),
    468: RealPokemon("togekiss", ("fairy", "flying"), (85, 50, 95, 120, 115, 80), 87),
    473: RealPokemon("mamoswine", ("ice", "ground"), (110, 130, 80, 70, 60, 80), 112),
    609: RealPokemon("chandelure", ("ghost", "fire"), (60, 55, 90, 145, 90, 80), 308),
    635: RealPokemon("hydreigon", ("dark", "dragon"), (92, 105, 90, 125, 90, 98), 323),
    637: RealPokemon("volcarona", ("bug", "fire"), (85, 60, 65, 135, 105, 100), 324),
    663: RealPokemon("talonflame", ("fire", "flying"), (78, 81, 71, 74, 69, 126), 341),
    700: RealPokemon("sylveon", ("fairy",), (95, 65, 65, 110, 130, 60), 67),
    784: RealPokemon("kommo-o", ("dragon", "fighting"), (75, 110, 125, 100, 105, 85), 408),
    887: RealPokemon("dragapult", ("dragon", "ghost"), (88, 120, 75, 100, 75, 142), 466),
    983: RealPokemon("kingambit", ("dark", "steel"), (100, 135, 120, 60, 85, 50), 317),
    1000: RealPokemon("gholdengo", ("steel", "ghost"), (87, 60, 95, 133, 91, 84), 528),
    10009: RealPokemon("rotom-wash", ("electric", "water"), (50, 65, 107, 105, 107, 86), 240),
}
LEGENDARY = {145, 150}
MYTHICAL = {151}
# Alternate forms, with their species: Rotom-Wash is a form of Rotom.
FORMS = {10009: 479}


def real_columns(pokemon_id: int, **overrides: Any) -> dict[str, Any]:
    """A real Pokémon as the pokemon table's columns, less the sync's bookkeeping."""
    pokemon = REAL_POKEMON[pokemon_id]
    hp, attack, defense, sp_attack, sp_defense, speed = pokemon.stats
    columns: dict[str, Any] = {
        "id": pokemon_id,
        "name": pokemon.name,
        "types": list(pokemon.types),
        "hp": hp,
        "attack": attack,
        "defense": defense,
        "sp_attack": sp_attack,
        "sp_defense": sp_defense,
        "speed": speed,
        "sprite_url": None,
        "is_default": pokemon_id not in FORMS,
    }
    return columns | overrides


def add_type_chart(session: Session) -> None:
    """Stores the type chart, as a sync would."""
    store_type_chart(session, MATCHUPS)


def add_real_pokemon(session: Session, *ids: int) -> None:
    """Saves these real Pokémon, each with its species and evolution family, marked legendary
    or mythical as in the games. Each is its species' only Pokémon.
    """
    session.add_all(make_pokemon(**real_columns(pokemon_id)) for pokemon_id in ids)
    session.flush()
    for pokemon_id in ids:
        add_species(
            session,
            FORMS.get(pokemon_id, pokemon_id),
            family=REAL_POKEMON[pokemon_id].family,
            pokemon_ids=[pokemon_id],
            is_legendary=pokemon_id in LEGENDARY,
            is_mythical=pokemon_id in MYTHICAL,
        )


def profile(**fields: Any) -> Profile:
    """A Pokémon as scoring sees it: Normal, with a base stat total of 500 and 100 Speed, unless
    told otherwise.
    """
    defaults: dict[str, Any] = {
        "id": 1,
        "types": (PokemonType.NORMAL,),
        "stat_total": 500,
        "speed": 100,
    }
    return Profile(**(defaults | fields))
