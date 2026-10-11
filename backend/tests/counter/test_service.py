import pytest
from sqlalchemy.orm import Session

from app.counter.enums import Verdict
from app.counter.exceptions import (
    TooFewCandidatesError,
    TypeChartMissingError,
    UnknownPokemonError,
)
from app.counter.schemas import Challenger, TeamMatchupQuery
from app.counter.service import find_counter_team
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
    """The type chart, and the real Pokémon the tests know, each in its own family."""
    add_real_pokemon(db_session, *REAL_POKEMON)


# --- Counter teams ---


@pytest.mark.usefixtures("pokedex")
def test_counters_a_lone_charizard_with_rock_water_or_electric(db_session: Session) -> None:
    (pick,) = find_counter_team(db_session, query(CHARIZARD))

    (matchup,) = pick.matchups
    assert matchup.opponent_id == CHARIZARD
    assert matchup.verdict in {Verdict.COUNTER, Verdict.CHECK}
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


@pytest.mark.usefixtures("pokedex")
def test_finds_the_same_team_every_time(db_session: Session) -> None:
    team = query(CHARIZARD, VENUSAUR, BLASTOISE, SNORLAX)

    assert find_counter_team(db_session, team) == find_counter_team(db_session, team)


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
def test_counters_a_pokemon_pokeapi_no_longer_lists(db_session: Session) -> None:
    remove_pokemon(db_session, CHARIZARD)

    (pick,) = find_counter_team(db_session, query(CHARIZARD))

    assert pick.pokemon.id != CHARIZARD
    assert pick.matchups[0].verdict is not Verdict.LOSES


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
