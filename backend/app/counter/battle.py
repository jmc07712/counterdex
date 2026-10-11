"""The battle model: how a one-on-one between two Pokémon goes, worked out from their types and
base stats.

Each Pokémon is taken at level 50 and attacks every turn with its strongest move: one of
MOVE_POWER, of one of its own types, physical or special. The moves it really learns, its
abilities and items, critical hits and the random factor are left out.
"""

import math
from collections.abc import Mapping
from typing import Any

from app.counter.constants import HP_BONUS, LEVEL, MOVE_POWER, SAME_TYPE_BONUS, STAT_BONUS
from app.counter.enums import RelativeSpeed, Verdict
from app.counter.types import Exchange, Fighter, Hit, TypeChart
from app.pokemon.enums import PokemonType


def level_50_fighter(columns: Mapping[Any, Any]) -> Fighter:
    """A Pokémon from the pokemon table's columns, with its stats at level 50."""
    return Fighter(
        id=columns["id"],
        types=tuple(PokemonType(type_) for type_ in columns["types"]),
        hp=columns["hp"] + HP_BONUS,
        attack=columns["attack"] + STAT_BONUS,
        defense=columns["defense"] + STAT_BONUS,
        sp_attack=columns["sp_attack"] + STAT_BONUS,
        sp_defense=columns["sp_defense"] + STAT_BONUS,
        speed=columns["speed"] + STAT_BONUS,
    )


def damage(attack: int, defense: int, multiplier: float) -> int:
    """The damage of a MOVE_POWER move of the attacker's own type, by the games' formula at
    LEVEL: the attacker's Attack (or Sp. Atk) against the defender's Defense (or Sp. Def), times
    the same-type bonus and the type multiplier, rounded down. The random factor is left out,
    which is the same as its highest roll.
    """
    base = (2 * LEVEL // 5 + 2) * MOVE_POWER * attack // defense // 50 + 2
    return math.floor(base * SAME_TYPE_BONUS * multiplier)


def best_hit(attacker: Fighter, defender: Fighter, chart: TypeChart) -> Hit:
    """The attacker's strongest hit on the defender: of its types, the one that does the most
    damage, physical or special, whichever does more. On a tie, its primary type.
    """
    hits = [_hit(type_, attacker, defender, chart) for type_ in attacker.types]
    # max keeps the first of equals, and a Pokémon's primary type comes first.
    return max(hits, key=lambda hit: hit.damage)


def _hit(type_: PokemonType, attacker: Fighter, defender: Fighter, chart: TypeChart) -> Hit:
    multiplier = math.prod(chart[type_, defending] for defending in defender.types)
    physical = damage(attacker.attack, defender.defense, multiplier)
    special = damage(attacker.sp_attack, defender.sp_defense, multiplier)
    most = max(physical, special)
    return Hit(
        type=type_,
        multiplier=multiplier,
        damage=most,
        hits=math.ceil(defender.hp / most) if most else None,
    )


def relative_speed(fighter: Fighter, opponent: Fighter) -> RelativeSpeed:
    if fighter.speed > opponent.speed:
        return RelativeSpeed.FASTER
    if fighter.speed < opponent.speed:
        return RelativeSpeed.SLOWER
    return RelativeSpeed.TIED


def exchange(fighter: Fighter, opponent: Fighter, chart: TypeChart) -> Exchange:
    """How a one-on-one between the two goes, from the fighter's side.

    From a neutral start the faster one strikes first. A speed tie counts as the opponent's,
    since the games settle it at random. Switching in, the fighter takes a free hit before that.
    It counters the opponent if it wins even after switching in, checks it if it wins only from
    a neutral start, and otherwise loses.
    """
    hit = best_hit(fighter, opponent, chart)
    opponent_hit = best_hit(opponent, fighter, chart)
    speed = relative_speed(fighter, opponent)
    strikes_first = speed is RelativeSpeed.FASTER
    neutral = _hp_left_after_winning(
        fighter, hit, opponent_hit, strikes_first=strikes_first, switched_in=False
    )
    switched_in = _hp_left_after_winning(
        fighter, hit, opponent_hit, strikes_first=strikes_first, switched_in=True
    )
    if switched_in is not None:
        verdict, hp_left = Verdict.COUNTER, switched_in
    elif neutral is not None:
        verdict, hp_left = Verdict.CHECK, neutral
    else:
        verdict = Verdict.LOSES
        hp_left = _opponent_hp_left(opponent, hit, opponent_hit, strikes_first=strikes_first)
    return Exchange(
        verdict=verdict,
        hp_left=hp_left,
        neutral_hp_left=neutral,
        speed=speed,
        hit=hit,
        opponent_hit=opponent_hit,
    )


def _hp_left_after_winning(
    fighter: Fighter, hit: Hit, opponent_hit: Hit, *, strikes_first: bool, switched_in: bool
) -> float | None:
    """The fighter's share of HP left when it knocks the opponent out; None if it's knocked out
    first, or can't hurt the opponent.
    """
    if hit.hits is None:
        return None
    # The opponent's hits it takes before landing its last one.
    taken = hit.hits - 1 + (0 if strikes_first else 1) + (1 if switched_in else 0)
    if opponent_hit.hits is not None and taken >= opponent_hit.hits:
        return None
    return (fighter.hp - taken * opponent_hit.damage) / fighter.hp


def _opponent_hp_left(
    opponent: Fighter, hit: Hit, opponent_hit: Hit, *, strikes_first: bool
) -> float:
    """The opponent's share of HP left when it wins from a neutral start, or when neither can
    hurt the other.
    """
    if opponent_hit.hits is None:
        return 1.0
    # The fighter's hits that land before the opponent's last one.
    landed = opponent_hit.hits - (0 if strikes_first else 1)
    return (opponent.hp - landed * hit.damage) / opponent.hp
