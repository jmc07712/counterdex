import pytest

from app.counter.constants import BACKUP_WEIGHT, THREAT_PENALTY
from app.counter.enums import RelativeSpeed, Verdict
from app.counter.search import (
    answer_score,
    battle_order,
    counter_team,
    lead_score,
    team_score,
)
from app.counter.types import Candidate, Contender, Exchange, Hit
from app.pokemon.enums import PokemonType
from tests.support.counter import fighter

COUNTER, CHECK, LOSES = Verdict.COUNTER, Verdict.CHECK, Verdict.LOSES


def result(verdict: Verdict, hp_left: float, neutral_hp_left: float | None = None) -> Exchange:
    """An exchange with this verdict and margin. Unless given, its neutral-start margin is its
    margin for a counter or check. The search doesn't look at the hits.
    """
    hit = Hit(type=PokemonType.NORMAL, multiplier=1, damage=1, hits=1)
    if neutral_hp_left is None and verdict is not LOSES:
        neutral_hp_left = hp_left
    return Exchange(
        verdict=verdict,
        hp_left=hp_left,
        neutral_hp_left=neutral_hp_left,
        speed=RelativeSpeed.FASTER,
        hit=hit,
        opponent_hit=hit,
    )


def contender(pokemon_id: int, *exchanges: Exchange, family: int | None = None) -> Contender:
    """A candidate with these exchanges, one per opponent, in its own family unless given one."""
    candidate = Candidate(fighter(id=pokemon_id), family_id=family or pokemon_id)
    return Contender(candidate, exchanges)


def ids(team: list[Contender]) -> list[int]:
    return [member.candidate.fighter.id for member in team]


# --- Scores ---


def test_scores_a_counter_above_a_check_above_a_loss_whatever_the_margins() -> None:
    assert (
        answer_score(result(COUNTER, 0.01))
        > answer_score(result(CHECK, 1))
        > answer_score(result(LOSES, 0.01))
    )


def test_scores_a_bigger_margin_higher() -> None:
    assert answer_score(result(CHECK, 0.8)) > answer_score(result(CHECK, 0.2))
    # When it loses, the margin is the opponent's HP left.
    assert answer_score(result(LOSES, 0.2)) > answer_score(result(LOSES, 0.8))


def test_scores_a_lead_from_a_neutral_start_where_a_check_is_as_good_as_a_counter() -> None:
    assert lead_score(result(CHECK, 0.8)) > lead_score(result(COUNTER, 0.2, neutral_hp_left=0.6))
    assert lead_score(result(LOSES, 0.2)) == answer_score(result(LOSES, 0.2))


def test_scores_a_team_by_its_best_answer_to_each_opponent() -> None:
    team = [contender(1, result(CHECK, 0.5), result(LOSES, 1))]

    assert team_score(team) == answer_score(result(CHECK, 0.5)) + answer_score(result(LOSES, 1))


def test_adds_a_share_of_a_backup_answer() -> None:
    first = contender(1, result(COUNTER, 0.5))
    backup = contender(2, result(CHECK, 0.5))

    assert team_score([first, backup]) == pytest.approx(
        team_score([first]) + BACKUP_WEIGHT * answer_score(result(CHECK, 0.5))
    )


def test_takes_off_a_penalty_for_an_opponent_that_beats_three_of_the_team() -> None:
    answer = contender(1, result(COUNTER, 1))
    beaten = [contender(pokemon_id, result(LOSES, 1)) for pokemon_id in (2, 3, 4)]

    assert team_score([answer, *beaten[:2]]) == team_score([answer])
    assert team_score([answer, *beaten]) == team_score([answer]) - THREAT_PENALTY


# --- Counter teams ---


def test_picks_as_many_as_it_is_asked_for() -> None:
    pool = [contender(pokemon_id, result(CHECK, pokemon_id / 10)) for pokemon_id in range(1, 9)]

    assert len(counter_team(pool, size=3)) == 3


def test_picks_a_counter_over_a_check() -> None:
    pool = [contender(1, result(CHECK, 1)), contender(2, result(COUNTER, 0.1))]

    assert ids(counter_team(pool, size=1)) == [2]


def test_breaks_ties_by_the_lowest_id() -> None:
    pool = [contender(2, result(CHECK, 0.5)), contender(1, result(CHECK, 0.5))]

    assert ids(counter_team(pool, size=1)) == [1]


def test_picks_one_pokemon_from_each_evolution_family() -> None:
    pool = [
        contender(1, result(COUNTER, 1), result(COUNTER, 1), family=7),
        contender(2, result(COUNTER, 0.9), result(COUNTER, 0.9), family=7),
        contender(3, result(CHECK, 0.5), result(CHECK, 0.5)),
    ]

    assert sorted(ids(counter_team(pool, size=2))) == [1, 3]


def test_swaps_out_a_pick_that_a_better_pair_leaves_behind() -> None:
    # Greedily, the all-rounder comes first; the two specialists answer both opponents better.
    pool = [
        contender(1, result(CHECK, 0.9), result(CHECK, 0.9)),
        contender(2, result(COUNTER, 1), result(LOSES, 1)),
        contender(3, result(LOSES, 1), result(COUNTER, 1)),
    ]

    assert sorted(ids(counter_team(pool, size=2))) == [2, 3]


def test_picks_the_same_team_every_time() -> None:
    pool = [
        contender(pokemon_id, result(CHECK, (pokemon_id * 7 % 10) / 10), result(COUNTER, 0.5))
        for pokemon_id in range(1, 30)
    ]

    assert ids(counter_team(pool, size=4)) == ids(counter_team(list(reversed(pool)), size=4))


# --- Battle order ---


def test_leads_with_the_best_answer_to_their_lead_from_a_neutral_start() -> None:
    counter = contender(1, result(COUNTER, 0.2, neutral_hp_left=0.6), result(LOSES, 1))
    check = contender(2, result(CHECK, 0.8), result(LOSES, 1))

    assert ids(battle_order([counter, check])) == [2, 1]


def test_follows_the_lead_in_the_order_of_the_opponents_each_answers_best() -> None:
    lead = contender(9, result(COUNTER, 1), result(LOSES, 1), result(LOSES, 1))
    answers_third = contender(1, result(LOSES, 1), result(CHECK, 0.2), result(COUNTER, 0.5))
    answers_second = contender(2, result(LOSES, 1), result(COUNTER, 0.5), result(CHECK, 0.2))
    also_second = contender(3, result(LOSES, 1), result(COUNTER, 0.9), result(LOSES, 1))

    team = [answers_third, also_second, lead, answers_second]

    assert ids(battle_order(team)) == [9, 2, 3, 1]


def test_returns_a_counter_team_in_battle_order() -> None:
    pool = [
        contender(1, result(LOSES, 1), result(COUNTER, 1)),
        contender(2, result(COUNTER, 1), result(LOSES, 1)),
    ]

    assert ids(counter_team(pool, size=2)) == [2, 1]
