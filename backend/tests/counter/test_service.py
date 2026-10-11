import pytest
from sqlalchemy.orm import Session

from app.counter.enums import Rating
from app.counter.exceptions import (
    TooFewCandidatesError,
    TypeChartMissingError,
    UnknownPokemonError,
)
from app.counter.schemas import Challenger, MatchupsQuery, TeamMatchupQuery
from app.counter.service import find_counter_team, list_team_threats, score_teams
from app.pokemon.enums import PokemonType
from tests.support.counter import REAL_POKEMON, add_real_pokemon, add_type_chart, remove_pokemon
from tests.support.pokemon import add_species, make_pokemon

CHARIZARD, VENUSAUR, BLASTOISE, ARCANINE, SNORLAX = 6, 3, 9, 59, 143


def query(*pokemon_ids: int, forms: bool = False, legendaries: bool = False) -> TeamMatchupQuery:
    return TeamMatchupQuery(pokemon_ids=list(pokemon_ids), forms=forms, legendaries=legendaries)


def ids(challengers: list[Challenger]) -> list[int]:
    return [challenger.pokemon.id for challenger in challengers]


@pytest.fixture
def type_chart(db_session: Session) -> None:
    add_type_chart(db_session)


@pytest.fixture
def pokedex(db_session: Session, type_chart: None) -> None:
    """The type chart, and every real Pokémon the tests know."""
    add_real_pokemon(db_session, *REAL_POKEMON)


# --- Counter teams ---


@pytest.mark.usefixtures("pokedex")
def test_counters_a_lone_charizard_with_rock_water_or_electric(db_session: Session) -> None:
    (pick,) = find_counter_team(db_session, query(CHARIZARD))

    (matchup,) = pick.matchups
    assert matchup.opponent_id == CHARIZARD
    assert matchup.rating is Rating.GOOD
    assert matchup.attack.type in {PokemonType.ROCK, PokemonType.WATER, PokemonType.ELECTRIC}


@pytest.mark.usefixtures("pokedex")
def test_finds_a_team_as_big_as_theirs_with_a_matchup_against_each(db_session: Session) -> None:
    team = find_counter_team(db_session, query(CHARIZARD, VENUSAUR, BLASTOISE))

    assert len(team) == 3
    for member in team:
        assert [matchup.opponent_id for matchup in member.matchups] == [
            CHARIZARD,
            VENUSAUR,
            BLASTOISE,
        ]


@pytest.mark.usefixtures("type_chart")
def test_picks_one_pokemon_from_each_evolution_family(db_session: Session) -> None:
    # Two strong Water Pokémon, which the team would take both of if they were in two families.
    strong = {"types": ["water"], "hp": 200, "sp_attack": 200, "sp_defense": 200, "speed": 200}
    add_real_pokemon(db_session, CHARIZARD, ARCANINE, SNORLAX)
    db_session.add_all(
        [
            make_pokemon(id=301, name="pokemon-301", **strong),
            make_pokemon(id=302, name="pokemon-302", **strong),
        ]
    )
    db_session.flush()
    add_species(db_session, 301, family=77, pokemon_ids=[301])
    add_species(db_session, 302, family=77, evolves_from=301, pokemon_ids=[302])

    team = find_counter_team(db_session, query(CHARIZARD, ARCANINE))

    assert len({301, 302} & set(ids(team))) == 1
    assert len({member.pokemon.family_id for member in team}) == 2


@pytest.mark.usefixtures("pokedex")
def test_scores_a_pokemon_pokeapi_no_longer_lists_on_their_team(db_session: Session) -> None:
    remove_pokemon(db_session, CHARIZARD)

    (pick,) = find_counter_team(db_session, query(CHARIZARD))

    assert pick.pokemon.id != CHARIZARD
    assert pick.matchups[0].rating is Rating.GOOD


@pytest.mark.usefixtures("pokedex")
def test_refuses_an_id_no_pokemon_has(db_session: Session) -> None:
    with pytest.raises(UnknownPokemonError):
        find_counter_team(db_session, query(CHARIZARD, 99999))


def test_refuses_to_work_without_a_type_chart(db_session: Session) -> None:
    add_real_pokemon(db_session, *REAL_POKEMON)

    with pytest.raises(TypeChartMissingError):
        find_counter_team(db_session, query(CHARIZARD))


@pytest.mark.usefixtures("type_chart")
def test_refuses_a_team_bigger_than_the_families_to_choose_from(db_session: Session) -> None:
    # Two families to choose from, and a third Pokémon whose species isn't stored.
    add_real_pokemon(db_session, CHARIZARD, BLASTOISE)
    db_session.add(make_pokemon(id=500, name="pokemon-500"))
    db_session.flush()

    with pytest.raises(TooFewCandidatesError):
        find_counter_team(db_session, query(CHARIZARD, BLASTOISE, 500))


# --- Threats ---


@pytest.mark.usefixtures("pokedex")
def test_lists_twelve_threats_with_how_each_matches_up_against_the_team(
    db_session: Session,
) -> None:
    threats = list_team_threats(db_session, query(CHARIZARD, VENUSAUR, BLASTOISE))

    assert len(threats) == 12
    for threat in threats:
        assert [matchup.opponent_id for matchup in threat.matchups] == [
            CHARIZARD,
            VENUSAUR,
            BLASTOISE,
        ]
    totals = [sum(matchup.score for matchup in threat.matchups) for threat in threats]
    assert totals == sorted(totals, reverse=True)


@pytest.mark.usefixtures("pokedex")
def test_lists_one_threat_from_each_evolution_family(db_session: Session) -> None:
    # Jolteon, Umbreon and Sylveon are all Eevee's family; Pikachu and Raichu are one family.
    threats = list_team_threats(db_session, query(BLASTOISE, 130, 131))

    families = [threat.pokemon.family_id for threat in threats]
    assert len(set(families)) == len(families)


# --- One team against another ---

GOLEM = 76


def versus(ours: list[int], theirs: list[int]) -> MatchupsQuery:
    return MatchupsQuery(pokemon_ids=ours, opponent_ids=theirs)


@pytest.mark.usefixtures("pokedex")
def test_scores_each_of_ours_against_each_of_theirs_in_the_orders_given(
    db_session: Session,
) -> None:
    scored = score_teams(db_session, versus([SNORLAX, GOLEM], [CHARIZARD, VENUSAUR]))

    assert [member.pokemon.id for member in scored.members] == [SNORLAX, GOLEM]
    for member in scored.members:
        assert [matchup.opponent_id for matchup in member.matchups] == [CHARIZARD, VENUSAUR]
    golem_on_charizard = scored.members[1].matchups[0]
    assert (golem_on_charizard.attack.type, golem_on_charizard.score) == (
        PokemonType.ROCK,
        2.6525,
    )


@pytest.mark.usefixtures("pokedex")
def test_finds_our_best_answer_to_each_of_theirs(db_session: Session) -> None:
    # Golem's Rock is 4x against Charizard; against Venusaur, whose Grass is 4x against Golem,
    # Snorlax does better, though only evenly.
    scored = score_teams(db_session, versus([SNORLAX, GOLEM], [CHARIZARD, VENUSAUR]))

    assert [
        (answer.opponent_id, answer.pokemon_id, answer.rating) for answer in scored.answers
    ] == [
        (CHARIZARD, GOLEM, Rating.GOOD),
        (VENUSAUR, SNORLAX, Rating.EVEN),
    ]
    assert scored.answers[1].score == -0.2125
    assert scored.every_opponent_answered is False


@pytest.mark.usefixtures("pokedex")
def test_says_when_every_one_of_theirs_has_a_good_answer(db_session: Session) -> None:
    scored = score_teams(db_session, versus([GOLEM], [CHARIZARD]))

    assert scored.every_opponent_answered is True


@pytest.mark.usefixtures("pokedex")
def test_scores_pokemon_pokeapi_no_longer_lists_on_either_team(db_session: Session) -> None:
    remove_pokemon(db_session, GOLEM)
    remove_pokemon(db_session, CHARIZARD)

    scored = score_teams(db_session, versus([GOLEM], [CHARIZARD]))

    assert scored.answers[0].pokemon_id == GOLEM


@pytest.mark.usefixtures("pokedex")
@pytest.mark.parametrize(
    ("ours", "theirs"), [([GOLEM, 99999], [CHARIZARD]), ([GOLEM], [CHARIZARD, 99999])]
)
def test_refuses_an_id_no_pokemon_has_on_either_team(
    db_session: Session, ours: list[int], theirs: list[int]
) -> None:
    with pytest.raises(UnknownPokemonError):
        score_teams(db_session, versus(ours, theirs))


def test_refuses_to_score_teams_without_a_type_chart(db_session: Session) -> None:
    add_real_pokemon(db_session, GOLEM, CHARIZARD)

    with pytest.raises(TypeChartMissingError):
        score_teams(db_session, versus([GOLEM], [CHARIZARD]))
