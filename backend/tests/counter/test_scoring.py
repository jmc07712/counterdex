import pytest

from app.counter.enums import Rating, RelativeSpeed
from app.counter.scoring import (
    best_attack,
    matchup,
    multiplier,
    points,
    profile_from_columns,
    rating,
    weak_to,
)
from app.counter.types import Attack, Profile
from app.pokemon.enums import PokemonType
from tests.support.counter import TYPE_CHART, profile, real_columns

FIRE, WATER, GRASS, ROCK, ELECTRIC = (
    PokemonType.FIRE,
    PokemonType.WATER,
    PokemonType.GRASS,
    PokemonType.ROCK,
    PokemonType.ELECTRIC,
)


def real(pokemon_id: int) -> Profile:
    """A real Pokémon as scoring sees it."""
    return profile_from_columns(real_columns(pokemon_id))


CHARIZARD, BLASTOISE, VENUSAUR, ARCANINE, GOLEM, RAICHU = 6, 9, 3, 59, 76, 26


def test_reads_a_pokemons_types_base_stat_total_and_speed() -> None:
    # Charizard's base stats are 78, 84, 78, 109, 85 and 100.
    assert real(CHARIZARD) == Profile(
        id=CHARIZARD, types=(FIRE, PokemonType.FLYING), stat_total=534, speed=100
    )


# --- Multipliers and their points ---


@pytest.mark.parametrize(
    ("attacking", "defender", "expected"),
    [
        pytest.param(ROCK, CHARIZARD, 4, id="double-against-both-types"),
        pytest.param(GRASS, CHARIZARD, 0.25, id="half-against-both-types"),
        pytest.param(ELECTRIC, GOLEM, 0, id="no-effect-on-one-type"),
        pytest.param(FIRE, BLASTOISE, 0.5, id="one-type"),
    ],
)
def test_multiplies_an_attacking_types_multiplier_against_each_defending_type(
    attacking: PokemonType, defender: int, expected: float
) -> None:
    assert multiplier(attacking, real(defender), TYPE_CHART) == expected


def test_two_defending_types_can_cancel_out() -> None:
    # Fire does half damage to Water and double to Grass.
    assert multiplier(FIRE, profile(types=(WATER, GRASS)), TYPE_CHART) == 1


@pytest.mark.parametrize(
    ("value", "expected"), [(4, 2), (2, 1), (1, 0), (0.5, -1), (0.25, -2), (0, -3)]
)
def test_scores_a_multiplier_as_its_log2_and_no_effect_as_minus_three(
    value: float, expected: int
) -> None:
    assert points(value) == expected


def test_attacks_with_whichever_of_its_types_is_most_effective() -> None:
    # Against Blastoise, Charizard's Fire does half damage and its Flying normal damage.
    assert best_attack(real(CHARIZARD), real(BLASTOISE), TYPE_CHART) == Attack(
        PokemonType.FLYING, 1
    )


def test_attacks_with_its_primary_type_when_both_are_as_effective() -> None:
    # Fire and Flying both do double damage to Venusaur.
    assert best_attack(real(CHARIZARD), real(VENUSAUR), TYPE_CHART) == Attack(FIRE, 2)


# --- Scoring a matchup ---


def test_scores_offense_defense_power_and_speed() -> None:
    result = matchup(real(GOLEM), real(CHARIZARD), TYPE_CHART)

    assert (result.attack, result.opponent_attack) == (Attack(ROCK, 4), Attack(FIRE, 0.5))
    assert (result.speed, result.stat_total_difference) == (RelativeSpeed.SLOWER, -39)
    # Offense: Rock is 4x against Charizard, +2. Defense: Charizard's best is Fire, 1/2x against
    # Golem, so -1 turned around, +1. Power: Golem's total is 495 to Charizard's 534, so
    # 0.25 * -39 / 100. Speed: Golem is slower, -0.25.
    assert result.score == pytest.approx(2 + 1 - 0.0975 - 0.25)
    assert result.rating is Rating.GOOD


def test_scores_being_immune_to_all_of_the_opponents_types_as_plus_three() -> None:
    # Normal can't hurt Ghost, and Fighting does double damage to Normal.
    result = matchup(
        profile(types=(PokemonType.GHOST, PokemonType.FIGHTING)), profile(), TYPE_CHART
    )

    assert (result.attack, result.opponent_attack) == (
        Attack(PokemonType.FIGHTING, 2),
        Attack(PokemonType.NORMAL, 0),
    )
    assert result.score == 1 + 3


def test_scores_an_attack_with_no_effect_as_minus_three() -> None:
    # Ghost can't hurt Normal, nor Normal Ghost.
    result = matchup(profile(types=(PokemonType.GHOST,)), profile(), TYPE_CHART)

    assert result.score == -3 + 3


@pytest.mark.parametrize(("stat_total", "power"), [(600, 0.25), (500, 0), (300, -0.5)])
def test_adds_a_quarter_point_per_100_of_base_stat_total_difference(
    stat_total: int, power: float
) -> None:
    assert matchup(profile(stat_total=stat_total), profile(), TYPE_CHART).score == power


@pytest.mark.parametrize(
    ("speed", "relative", "bonus"),
    [
        (101, RelativeSpeed.FASTER, 0.25),
        (100, RelativeSpeed.TIED, 0),
        (99, RelativeSpeed.SLOWER, -0.25),
    ],
)
def test_adds_a_quarter_point_for_being_faster_and_takes_one_off_for_being_slower(
    speed: int, relative: RelativeSpeed, bonus: float
) -> None:
    result = matchup(profile(speed=speed), profile(), TYPE_CHART)

    assert (result.speed, result.score) == (relative, bonus)


def test_gives_a_score_as_it_is_on_paper() -> None:
    # 0.25 * 7 / 100 - 0.25 comes out of float arithmetic as -0.23249999999999998.
    slightly_stronger_but_slower = profile(stat_total=507, speed=99)

    assert matchup(slightly_stronger_but_slower, profile(), TYPE_CHART).score == -0.2325


def test_scores_the_opponents_side_as_the_opposite() -> None:
    golem_side = matchup(real(GOLEM), real(CHARIZARD), TYPE_CHART)
    charizard_side = matchup(real(CHARIZARD), real(GOLEM), TYPE_CHART)

    assert charizard_side.score == pytest.approx(-golem_side.score)
    assert charizard_side.stat_total_difference == -golem_side.stat_total_difference


@pytest.mark.parametrize(
    ("score", "expected"),
    [
        (3, Rating.GOOD),
        (0.75, Rating.GOOD),
        (0.74, Rating.EVEN),
        (0, Rating.EVEN),
        (-0.74, Rating.EVEN),
        (-0.75, Rating.BAD),
        (-3, Rating.BAD),
    ],
)
def test_rates_a_score_good_even_or_bad(score: float, expected: Rating) -> None:
    assert rating(score) is expected


# --- Weaknesses ---


def test_finds_the_attacking_types_a_pokemon_is_weak_to() -> None:
    attacking = [ROCK, WATER, ELECTRIC, GRASS, FIRE]

    assert weak_to(real(CHARIZARD), attacking, TYPE_CHART) == {ROCK, WATER, ELECTRIC}
    # Electric has no effect on Golem, and Water and Grass are 4x against it.
    assert weak_to(real(GOLEM), attacking, TYPE_CHART) == {WATER, GRASS}
    assert weak_to(real(RAICHU), [ELECTRIC, FIRE], TYPE_CHART) == set()
