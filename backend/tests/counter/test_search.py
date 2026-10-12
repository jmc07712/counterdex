from collections.abc import Collection

from app.counter.enums import RelativeSpeed
from app.counter.scoring import rating
from app.counter.search import battle_order, counter_team, threats
from app.counter.types import Attack, Candidate, Contender, Matchup
from app.pokemon.enums import PokemonType
from tests.support.counter import profile

FIRE, WATER = PokemonType.FIRE, PokemonType.WATER


def scored(score: float) -> Matchup:
    """A matchup with this score. The search looks at nothing else."""
    attack = Attack(PokemonType.NORMAL, 1)
    return Matchup(
        attack=attack,
        opponent_attack=attack,
        speed=RelativeSpeed.TIED,
        stat_total_difference=0,
        score=score,
        rating=rating(score),
    )


def contender(
    pokemon_id: int,
    *scores: float,
    family: int | None = None,
    stat_total: int = 500,
    weak_to: Collection[PokemonType] = (),
) -> Contender:
    """A candidate with these scores, one per opponent, in its own family unless given one."""
    candidate = Candidate(
        profile(id=pokemon_id, stat_total=stat_total), family_id=family or pokemon_id
    )
    return Contender(candidate, tuple(scored(score) for score in scores), frozenset(weak_to))


def ids(team: list[Contender]) -> list[int]:
    return [member.candidate.profile.id for member in team]


# Scores whose totals are equal on paper, 2.315, but come out of float arithmetic as
# 2.3150000000000004 and 2.3149999999999995.
EQUAL_ON_PAPER = ((-2.26, 4.575, 0), (-2.81, 0.155, 4.97))


# --- Counter teams ---


def test_picks_as_many_as_it_is_asked_for() -> None:
    pool = [contender(pokemon_id, pokemon_id / 10) for pokemon_id in range(1, 9)]

    assert len(counter_team(pool, size=3)) == 3


def test_adds_the_pokemon_that_raises_the_teams_score_most() -> None:
    # The all-rounder first, then the one that adds most to it.
    pool = [
        contender(1, 3, 0),
        contender(2, 2.5, 2.5),
        contender(3, 0, 2.9),
    ]

    assert sorted(ids(counter_team(pool, size=2))) == [1, 2]


def test_adds_what_a_pokemon_adds_to_the_team_not_its_own_total() -> None:
    # Once the first is on the team, the second adds nothing for all its points; the third
    # answers the opponent no one else does.
    pool = [contender(1, 3, 0), contender(2, 2.9, 0), contender(3, 0, 2)]

    assert ids(counter_team(pool, size=2)) == [1, 3]


def test_picks_one_pokemon_from_each_evolution_family() -> None:
    pool = [
        contender(1, 3, 3, family=7),
        contender(2, 2.9, 2.9, family=7),
        contender(3, 1, 1),
    ]

    assert sorted(ids(counter_team(pool, size=2))) == [1, 3]


def test_avoids_three_pokemon_weak_to_one_of_their_types() -> None:
    # The first two are already as good as it gets; a third Fire-weak one would cost more than
    # its strength is worth.
    pool = [
        contender(1, 2, weak_to={FIRE}, stat_total=600),
        contender(2, 2, weak_to={FIRE}, stat_total=550),
        contender(3, 2, weak_to={FIRE}, stat_total=540),
        contender(4, 1.9),
    ]

    assert sorted(ids(counter_team(pool, size=3))) == [1, 2, 4]


def test_counts_the_penalty_once_for_each_type_three_are_weak_to() -> None:
    # On base stat total the third pick would be 3, but sharing both of the first two's
    # weaknesses costs it two penalties to 4's one.
    pool = [
        contender(1, 2, weak_to={FIRE, WATER}, stat_total=600),
        contender(2, 2, weak_to={FIRE, WATER}, stat_total=590),
        contender(3, 2, weak_to={FIRE, WATER}, stat_total=580),
        contender(4, 2, weak_to={FIRE}, stat_total=500),
    ]

    assert sorted(ids(counter_team(pool, size=3))) == [1, 2, 4]


def test_breaks_ties_by_total_score_across_their_pokemon() -> None:
    # Once the first is on the team, neither of the others raises its score.
    pool = [contender(1, 5, 5), contender(2, 1, 0), contender(3, 0, 2)]

    assert ids(counter_team(pool, size=2)) == [1, 3]


def test_then_by_base_stat_total() -> None:
    pool = [contender(1, 5), contender(2, 1, stat_total=500), contender(3, 1, stat_total=520)]

    assert ids(counter_team(pool, size=2)) == [1, 3]


def test_treats_team_scores_that_are_equal_on_paper_as_a_tie() -> None:
    higher_in_floats, lower_in_floats = EQUAL_ON_PAPER
    pool = [
        contender(1, *higher_in_floats, stat_total=500),
        contender(2, *lower_in_floats, stat_total=600),
    ]

    assert ids(counter_team(pool, size=1)) == [2]


def test_then_by_the_lowest_id() -> None:
    pool = [contender(1, 5), contender(3, 1), contender(2, 1)]

    assert ids(counter_team(pool, size=2)) == [1, 2]


# --- Battle order ---


def test_leads_with_the_best_score_against_their_lead() -> None:
    team = [contender(1, 1, 3), contender(2, 2, 0)]

    assert ids(battle_order(team)) == [2, 1]


def test_breaks_a_tie_for_the_lead_by_total_score() -> None:
    team = [contender(1, 2, 0), contender(2, 2, 1)]

    assert ids(battle_order(team)) == [2, 1]


def test_follows_the_lead_in_the_order_of_the_opponents_each_answers_best() -> None:
    lead = contender(9, 5, 0, 0)
    answers_third = contender(1, 0, 1, 2)
    answers_second = contender(2, 0, 2, 1)
    also_second_but_weaker = contender(3, 0, 1.5, 0)

    team = [answers_third, also_second_but_weaker, lead, answers_second]

    assert ids(battle_order(team)) == [9, 2, 3, 1]


def test_follows_the_first_of_the_opponents_a_pokemon_answers_equally_well() -> None:
    lead = contender(9, 5, 0, 0)
    tied = contender(2, 0, 2, 2)
    third = contender(1, 0, 1, 5)

    assert ids(battle_order([third, lead, tied])) == [9, 2, 1]


def test_returns_a_counter_team_in_battle_order() -> None:
    pool = [contender(1, 0, 3), contender(2, 3, 0)]

    assert ids(counter_team(pool, size=2)) == [2, 1]


# --- Threats ---


def test_ranks_threats_by_their_total_score() -> None:
    pool = [contender(1, 1, 1), contender(2, 3, -1), contender(3, 2, 2), contender(4, -1, -1)]

    assert ids(threats(pool, limit=10)) == [3, 1, 2, 4]


def test_lists_only_the_best_threat_of_each_family() -> None:
    pool = [contender(1, 1, family=7), contender(2, 3, family=7), contender(3, 2)]

    assert ids(threats(pool, limit=10)) == [2, 3]


def test_breaks_ties_between_threats_by_base_stat_total_then_id() -> None:
    pool = [contender(3, 1), contender(2, 1), contender(1, 1, stat_total=400)]

    assert ids(threats(pool, limit=10)) == [2, 3, 1]


def test_treats_threat_totals_that_are_equal_on_paper_as_a_tie() -> None:
    higher_in_floats, lower_in_floats = EQUAL_ON_PAPER
    pool = [
        contender(1, *higher_in_floats, stat_total=500),
        contender(2, *lower_in_floats, stat_total=600),
    ]

    assert ids(threats(pool, limit=10)) == [2, 1]


def test_lists_threats_up_to_the_limit() -> None:
    pool = [contender(pokemon_id, -pokemon_id) for pokemon_id in range(1, 6)]

    assert ids(threats(pool, limit=3)) == [1, 2, 3]
