import pytest
from sqlalchemy.orm import Session

from app.counter.enums import Rating
from app.counter.schemas import Challenger, MatchupsQuery, TeamMatchupQuery
from app.counter.service import find_counter_team, list_team_threats, score_teams
from app.pokemon.enums import PokemonType
from tests.support.counter import REAL_POKEMON, add_real_pokemon, add_type_chart, remove_pokemon

CHARIZARD, VENUSAUR, BLASTOISE, SNORLAX = 6, 3, 9, 143


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
def test_scores_a_pokemon_pokeapi_no_longer_lists_on_their_team(db_session: Session) -> None:
    remove_pokemon(db_session, CHARIZARD)

    (pick,) = find_counter_team(db_session, query(CHARIZARD))

    assert pick.pokemon.id != CHARIZARD
    assert pick.matchups[0].rating is Rating.GOOD


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


GYARADOS, LAPRAS, JOLTEON, SYLVEON = 130, 131, 135, 700


@pytest.mark.usefixtures("pokedex")
def test_leaves_the_teams_own_evolution_families_out_of_its_threats(db_session: Session) -> None:
    # Jolteon threatens Gyarados and Lapras, and is from Sylveon's family, Eevee's.
    assert JOLTEON in ids(list_team_threats(db_session, query(GYARADOS, LAPRAS)))

    threats = list_team_threats(db_session, query(GYARADOS, LAPRAS, SYLVEON))

    team_families = {REAL_POKEMON[member].family for member in (GYARADOS, LAPRAS, SYLVEON)}
    assert team_families.isdisjoint(threat.pokemon.family_id for threat in threats)


@pytest.mark.usefixtures("pokedex")
def test_leaves_a_removed_members_family_out_of_its_threats(db_session: Session) -> None:
    # Sylveon is still on the team after PokéAPI stops listing it, so Eevee's family stays out.
    remove_pokemon(db_session, SYLVEON)

    threats = list_team_threats(db_session, query(GYARADOS, LAPRAS, SYLVEON))

    assert JOLTEON not in ids(threats)


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
def test_scores_a_pokemon_against_itself_as_even(db_session: Session) -> None:
    scored = score_teams(db_session, versus([CHARIZARD], [CHARIZARD]))

    (member,) = scored.members
    (matchup,) = member.matchups
    assert (matchup.opponent_id, matchup.score, matchup.rating) == (CHARIZARD, 0, Rating.EVEN)


@pytest.mark.usefixtures("pokedex")
def test_scores_pokemon_pokeapi_no_longer_lists_on_either_team(db_session: Session) -> None:
    remove_pokemon(db_session, GOLEM)
    remove_pokemon(db_session, CHARIZARD)

    scored = score_teams(db_session, versus([GOLEM], [CHARIZARD]))

    (member,) = scored.members
    assert member.pokemon.id == GOLEM
    assert [matchup.rating for matchup in member.matchups] == [Rating.GOOD]
