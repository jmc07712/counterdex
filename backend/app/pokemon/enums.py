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


class ListingStatus(StrEnum):
    """Whether PokéAPI still lists a Pokémon."""

    LISTED = "listed"
    REMOVED = "removed"


class EvolutionTrigger(StrEnum):
    """What sets an evolution off, as PokéAPI names it."""

    LEVEL_UP = "level-up"
    IN_BATTLE_LEVEL_UP = "in-battle-level-up"
    USE_ITEM = "use-item"
    TRADE = "trade"
    SHED = "shed"
    SPIN = "spin"
    USE_MOVE = "use-move"
    AGILE_STYLE_MOVE = "agile-style-move"
    STRONG_STYLE_MOVE = "strong-style-move"
    TAKE_DAMAGE = "take-damage"
    RECOIL_DAMAGE = "recoil-damage"
    THREE_CRITICAL_HITS = "three-critical-hits"
    THREE_DEFEATED_BISHARP = "three-defeated-bisharp"
    TOWER_OF_DARKNESS = "tower-of-darkness"
    TOWER_OF_WATERS = "tower-of-waters"
    GIMMIGHOUL_COINS = "gimmighoul-coins"
    MELTAN_CANDIES = "meltan-candies"
    UNCLASSIFIED = "unclassified"


class TimeOfDay(StrEnum):
    DAY = "day"
    NIGHT = "night"
    DUSK = "dusk"
    FULL_MOON = "full-moon"


class Gender(StrEnum):
    FEMALE = "female"
    MALE = "male"


class RelativePhysicalStats(StrEnum):
    """How a Pokémon's Attack compares to its Defense."""

    ATTACK_HIGHER = "attack-higher"
    EQUAL = "equal"
    DEFENSE_HIGHER = "defense-higher"
