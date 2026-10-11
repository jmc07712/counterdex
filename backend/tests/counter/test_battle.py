import pytest

from app.counter.battle import best_hit, damage, exchange, level_50_fighter, relative_speed
from app.counter.enums import RelativeSpeed, Verdict
from app.counter.types import Fighter
from app.pokemon.enums import PokemonType
from tests.support.counter import TYPE_CHART, fighter, real_columns


def real(pokemon_id: int) -> Fighter:
    """A real Pokémon at level 50."""
    return level_50_fighter(real_columns(pokemon_id))


# --- Stats and damage ---


def test_takes_each_pokemon_at_level_50() -> None:
    # Charizard's base stats are 78, 84, 78, 109, 85 and 100.
    assert real(6) == Fighter(
        id=6,
        types=(PokemonType.FIRE, PokemonType.FLYING),
        hp=153,
        attack=104,
        defense=98,
        sp_attack=129,
        sp_defense=105,
        speed=120,
    )


@pytest.mark.parametrize(
    ("attack", "defense", "multiplier", "expected"),
    [
        # 22 * 90 * 100 // 100 // 50 + 2 = 41, and 41 * 1.5 = 61.5.
        pytest.param(100, 100, 1, 61, id="neutral"),
        pytest.param(100, 100, 2, 123, id="double"),
        pytest.param(100, 100, 4, 246, id="quadruple"),
        pytest.param(100, 100, 0.5, 30, id="half"),
        pytest.param(100, 100, 0.25, 15, id="quarter"),
        pytest.param(100, 100, 0, 0, id="none"),
        # 22 * 90 * 150 // 75 // 50 + 2 = 81, and 81 * 1.5 = 121.5.
        pytest.param(150, 75, 1, 121, id="stronger-attacker"),
    ],
)
def test_works_out_damage_with_the_games_formula(
    attack: int, defense: int, multiplier: float, expected: int
) -> None:
    assert damage(attack, defense, multiplier) == expected


@pytest.mark.parametrize(
    ("hp", "hits"),
    [pytest.param(61, 1, id="exactly-one"), (62, 2), (122, 2), (123, 3)],
)
def test_counts_the_hits_to_knock_a_pokemon_out(hp: int, hits: int) -> None:
    # Each hit does 61 damage.
    assert best_hit(fighter(), fighter(hp=hp), TYPE_CHART).hits == hits


# --- Type chart ---


def test_multiplies_both_of_the_defenders_types() -> None:
    # Rock does double damage to Fire and to Flying. Aerodactyl's Attack is 125 and Charizard's
    # Defense 98: 22 * 90 * 125 // 98 // 50 + 2 = 52, and 52 * 1.5 * 4 = 312.
    hit = best_hit(real(142), real(6), TYPE_CHART)

    assert (hit.type, hit.multiplier, hit.damage, hit.hits) == (PokemonType.ROCK, 4, 312, 1)


def test_two_types_can_cancel_out() -> None:
    # Fire does half damage to Water and double to Grass.
    hit = best_hit(real(59), fighter(types=(PokemonType.WATER, PokemonType.GRASS)), TYPE_CHART)

    assert hit.multiplier == 1


def test_a_type_that_cannot_hurt_the_defender_needs_no_hits() -> None:
    # Ground takes no damage from Electric.
    hit = best_hit(real(26), real(76), TYPE_CHART)

    assert (hit.type, hit.multiplier, hit.damage, hit.hits) == (PokemonType.ELECTRIC, 0, 0, None)


def test_attacks_with_whichever_of_its_types_does_more_damage() -> None:
    # Against Blastoise, Charizard's Fire does half damage and its Flying normal damage.
    hit = best_hit(real(6), real(9), TYPE_CHART)

    assert (hit.type, hit.multiplier) == (PokemonType.FLYING, 1)


def test_attacks_with_its_primary_type_when_both_do_the_same() -> None:
    # Fire and Flying both do double damage to Venusaur.
    assert best_hit(real(6), real(3), TYPE_CHART).type == PokemonType.FIRE


def test_attacks_physically_or_specially_whichever_does_more_damage() -> None:
    attacker = fighter(attack=200, sp_attack=200)
    physically_frail = fighter(hp=1000, defense=50, sp_defense=200)
    specially_frail = fighter(hp=1000, defense=200, sp_defense=50)

    # Against the weaker defense: 22 * 90 * 200 // 50 // 50 + 2 = 160, and 160 * 1.5 = 240.
    assert best_hit(attacker, physically_frail, TYPE_CHART).damage == 240
    assert best_hit(attacker, specially_frail, TYPE_CHART).damage == 240


# --- Speed ---


@pytest.mark.parametrize(
    ("speed", "expected"),
    [(101, RelativeSpeed.FASTER), (100, RelativeSpeed.TIED), (99, RelativeSpeed.SLOWER)],
)
def test_compares_speeds(speed: int, expected: RelativeSpeed) -> None:
    assert relative_speed(fighter(speed=speed), fighter(speed=100)) is expected


# --- Exchanges ---
# Normal against Normal, with 100 in every stat: each hit does 61 damage, so 122 HP takes two.


def test_checks_an_opponent_it_beats_only_by_striking_first() -> None:
    result = exchange(fighter(hp=122, speed=101), fighter(hp=122), TYPE_CHART)

    assert (result.verdict, result.speed) == (Verdict.CHECK, RelativeSpeed.FASTER)
    assert (result.hit.hits, result.opponent_hit.hits) == (2, 2)
    # It takes one hit before landing its second.
    assert result.hp_left == result.neutral_hp_left == pytest.approx(61 / 122)


def test_loses_a_speed_tie_it_would_win_by_striking_first() -> None:
    # The games settle a speed tie at random, so it can't count on striking first.
    result = exchange(fighter(hp=122), fighter(hp=122), TYPE_CHART)

    assert (result.verdict, result.speed) == (Verdict.LOSES, RelativeSpeed.TIED)
    assert result.neutral_hp_left is None
    # The winner's HP left: the opponent took one hit before landing its second.
    assert result.hp_left == pytest.approx(61 / 122)


def test_loses_to_a_faster_opponent_that_needs_as_many_hits() -> None:
    result = exchange(fighter(hp=122, speed=99), fighter(hp=122), TYPE_CHART)

    assert result.verdict is Verdict.LOSES


def test_counters_an_opponent_it_beats_even_after_taking_a_free_hit() -> None:
    # It needs two hits and can take three: switching in, it takes the free hit and one more.
    result = exchange(fighter(hp=183, speed=101), fighter(hp=122), TYPE_CHART)

    assert result.verdict is Verdict.COUNTER
    assert result.hp_left == pytest.approx(61 / 183)
    assert result.neutral_hp_left == pytest.approx(122 / 183)


def test_counters_a_faster_opponent_when_it_can_take_enough_hits() -> None:
    # It needs two hits and can take four: the free hit, then one before each of its own.
    result = exchange(fighter(hp=244, speed=99), fighter(hp=122), TYPE_CHART)

    assert result.verdict is Verdict.COUNTER
    assert result.hp_left == pytest.approx(61 / 244)


def test_counters_an_opponent_that_cannot_hurt_it() -> None:
    # Normal can't hurt Ghost, and Fighting does double damage to Normal.
    ghost = fighter(types=(PokemonType.GHOST, PokemonType.FIGHTING))

    result = exchange(ghost, fighter(), TYPE_CHART)

    assert (result.verdict, result.hp_left, result.opponent_hit.hits) == (Verdict.COUNTER, 1, None)


def test_loses_when_neither_can_hurt_the_other() -> None:
    result = exchange(fighter(types=(PokemonType.GHOST,)), fighter(), TYPE_CHART)

    assert (result.verdict, result.hp_left) == (Verdict.LOSES, 1)
    assert (result.hit.hits, result.opponent_hit.hits) == (None, None)
