"""Scoring how one Pokémon matches up against another, from their types and base stats alone
(see constants for the weights).
"""

import math
from collections.abc import Iterable, Mapping
from typing import Any

from app.counter.constants import (
    BAD_SCORE,
    GOOD_SCORE,
    NO_EFFECT_POINTS,
    POWER_WEIGHT,
    SCORE_DECIMALS,
    SPEED_POINTS,
)
from app.counter.enums import Rating, RelativeSpeed
from app.counter.types import Attack, Matchup, Profile, TypeChart
from app.pokemon.enums import PokemonType
from app.pokemon.schemas import STAT_NAMES


def profile_from_columns(columns: Mapping[Any, Any]) -> Profile:
    """A Pokémon from the pokemon table's columns, as scoring sees it."""
    return Profile(
        id=columns["id"],
        types=tuple(PokemonType(type_) for type_ in columns["types"]),
        stat_total=sum(columns[stat] for stat in STAT_NAMES),
        speed=columns["speed"],
    )


def multiplier(attacking: PokemonType, defender: Profile, chart: TypeChart) -> float:
    """How effective a type is against the defender: its multiplier against each of the
    defender's types, multiplied together.
    """
    return math.prod(chart[attacking, defending] for defending in defender.types)


def best_attack(attacker: Profile, defender: Profile, chart: TypeChart) -> Attack:
    """The attacker's most effective type against the defender; its primary type on a tie."""
    attacks = [Attack(type_, multiplier(type_, defender, chart)) for type_ in attacker.types]
    # max keeps the first of equals, and a Pokémon's primary type comes first.
    return max(attacks, key=lambda attack: attack.multiplier)


def points(value: float) -> int:
    """An attacking type's points for its multiplier: log2 of it, or NO_EFFECT_POINTS if it has
    no effect.
    """
    if value == 0:
        return NO_EFFECT_POINTS
    return round(math.log2(value))


def matchup(pokemon: Profile, opponent: Profile, chart: TypeChart) -> Matchup:
    """How the Pokémon matches up against the opponent, scored from its side as offense +
    defense + power + speed (see constants). The opponent's side scores the opposite.
    """
    attack = best_attack(pokemon, opponent, chart)
    opponent_attack = best_attack(opponent, pokemon, chart)
    speed = relative_speed(pokemon, opponent)
    difference = pokemon.stat_total - opponent.stat_total
    score = round(
        points(attack.multiplier)
        - points(opponent_attack.multiplier)
        + POWER_WEIGHT * difference / 100
        + _speed_points(speed),
        SCORE_DECIMALS,
    )
    return Matchup(
        attack=attack,
        opponent_attack=opponent_attack,
        speed=speed,
        stat_total_difference=difference,
        score=score,
        rating=rating(score),
    )


def relative_speed(pokemon: Profile, opponent: Profile) -> RelativeSpeed:
    if pokemon.speed > opponent.speed:
        return RelativeSpeed.FASTER
    if pokemon.speed < opponent.speed:
        return RelativeSpeed.SLOWER
    return RelativeSpeed.TIED


def _speed_points(speed: RelativeSpeed) -> float:
    match speed:
        case RelativeSpeed.FASTER:
            return SPEED_POINTS
        case RelativeSpeed.SLOWER:
            return -SPEED_POINTS
        case RelativeSpeed.TIED:
            return 0.0


def rating(score: float) -> Rating:
    """Good from GOOD_SCORE up, bad from BAD_SCORE down, and even between."""
    if score >= GOOD_SCORE:
        return Rating.GOOD
    if score <= BAD_SCORE:
        return Rating.BAD
    return Rating.EVEN


def weak_to(
    pokemon: Profile, attacking: Iterable[PokemonType], chart: TypeChart
) -> frozenset[PokemonType]:
    """The attacking types that are more than normally effective against the Pokémon."""
    return frozenset(type_ for type_ in attacking if multiplier(type_, pokemon, chart) > 1)
