"""The values a Pokémon's fields can take."""

from enum import StrEnum


class PokemonType(StrEnum):
    """Every type a Pokémon can have, in the games' order."""

    NORMAL = "normal"
    FIGHTING = "fighting"
    FLYING = "flying"
    POISON = "poison"
    GROUND = "ground"
    ROCK = "rock"
    BUG = "bug"
    GHOST = "ghost"
    STEEL = "steel"
    FIRE = "fire"
    WATER = "water"
    GRASS = "grass"
    ELECTRIC = "electric"
    PSYCHIC = "psychic"
    ICE = "ice"
    DRAGON = "dragon"
    DARK = "dark"
    FAIRY = "fairy"


class PokemonForm(StrEnum):
    """Which kind of alternate form a Pokémon is, such as a Mega Evolution or a regional form."""

    MEGA = "mega"
    GIGANTAMAX = "gigantamax"
    ALOLAN = "alolan"
    GALARIAN = "galarian"
    HISUIAN = "hisuian"
    PALDEAN = "paldean"
    OTHER = "other"


class FormFilter(StrEnum):
    """Which forms a list of Pokémon includes."""

    ALL = "all"
    DEFAULT = "default"
    ALTERNATE = "alternate"
