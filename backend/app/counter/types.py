"""Plain data passed between the battle model, the search and the service."""

from collections.abc import Mapping
from dataclasses import dataclass

from app.counter.enums import RelativeSpeed, Verdict
from app.pokemon.enums import PokemonType

# How much damage a move of one type does to a Pokémon of another, by (attacking, defending)
# type.
TypeChart = Mapping[tuple[PokemonType, PokemonType], float]


@dataclass(frozen=True)
class Fighter:
    """A Pokémon as the battle model sees it: its types, and its stats at level 50."""

    id: int
    types: tuple[PokemonType, ...]
    hp: int
    attack: int
    defense: int
    sp_attack: int
    sp_defense: int
    speed: int


@dataclass(frozen=True)
class Candidate:
    """A Pokémon a counter team or a threat can be, with its evolution family."""

    fighter: Fighter
    family_id: int


@dataclass(frozen=True)
class Hit:
    """An attacker's strongest hit on a defender."""

    # One of the attacker's own types.
    type: PokemonType
    # How effective the type is against the defender's: 0, 0.25, 0.5, 1, 2 or 4.
    multiplier: float
    damage: int
    # How many such hits knock the defender out; None if they do no damage.
    hits: int | None


@dataclass(frozen=True)
class Exchange:
    """How a one-on-one goes, from one Pokémon's side: it and its opponent trade their strongest
    hits until one is knocked out.
    """

    verdict: Verdict
    # The winner's share of its HP left at the end, from 0 to 1: this Pokémon's after switching
    # in, for a counter; its own from a neutral start, for a check; the opponent's from a neutral
    # start, when it loses.
    hp_left: float
    # Its own share of HP left after winning from a neutral start; None if it doesn't win one.
    neutral_hp_left: float | None
    speed: RelativeSpeed
    hit: Hit
    opponent_hit: Hit


@dataclass(frozen=True)
class Contender:
    """A candidate and its exchange with each of a team's Pokémon, in the team's order."""

    candidate: Candidate
    exchanges: tuple[Exchange, ...]
