"""Plain data passed between scoring, the search and the service."""

from collections.abc import Mapping
from dataclasses import dataclass

from app.counter.enums import Rating, RelativeSpeed
from app.pokemon.enums import PokemonType

# How much damage a move of one type does to a Pokémon of another, by (attacking, defending)
# type.
TypeChart = Mapping[tuple[PokemonType, PokemonType], float]


@dataclass(frozen=True)
class Profile:
    """What scoring looks at in a Pokémon: its types, base stat total and base Speed."""

    id: int
    types: tuple[PokemonType, ...]
    stat_total: int
    speed: int


@dataclass(frozen=True)
class Candidate:
    """A Pokémon a counter team or a threat can be, with its evolution family."""

    profile: Profile
    family_id: int


@dataclass(frozen=True)
class Attack:
    """A Pokémon's most effective type against an opponent."""

    type: PokemonType
    # Against the opponent's types, multiplied together: 0, 0.25, 0.5, 1, 2 or 4.
    multiplier: float


@dataclass(frozen=True)
class Matchup:
    """How a Pokémon matches up against an opponent, from the Pokémon's side."""

    attack: Attack
    opponent_attack: Attack
    speed: RelativeSpeed
    # Its base stat total less the opponent's.
    stat_total_difference: int
    score: float
    rating: Rating


@dataclass(frozen=True)
class Contender:
    """A candidate and its matchup with each of a team's Pokémon, in the team's order."""

    candidate: Candidate
    matchups: tuple[Matchup, ...]
    # The types of the team's Pokémon that are more than normally effective against it.
    weak_to: frozenset[PokemonType]
