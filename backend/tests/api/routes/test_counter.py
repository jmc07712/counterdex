from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.constants import COUNTER_TEAM_CACHE_CONTROL
from tests.support.counter import REAL_POKEMON, add_real_pokemon, add_type_chart
from tests.support.pokemon import make_pokemon

PATHS = ["/api/counter-team", "/api/team-threats"]
CHARIZARD, AERODACTYL, GOLEM = 6, 142, 76


@pytest.fixture
def pokedex(db_session: Session) -> None:
    """The type chart, and the real Pokémon the tests know, each in its own family."""
    add_type_chart(db_session)
    add_real_pokemon(db_session, *REAL_POKEMON)


@pytest.mark.usefixtures("pokedex")
def test_finds_a_counter_team_with_each_matchup(client: TestClient) -> None:
    response = client.get("/api/counter-team", params={"pokemon_id": CHARIZARD})

    assert response.status_code == 200
    (pick,) = response.json()
    assert (pick["pokemon"]["id"], pick["pokemon"]["name"]) == (AERODACTYL, "aerodactyl")
    assert pick["pokemon"]["family_id"] == 71
    # Rock is 4x against Charizard (+2), and Charizard's Fire 1/2x against Aerodactyl (+1).
    # Aerodactyl's base stat total is 515 to Charizard's 534 (0.25 * -19 / 100), and it's faster
    # (+0.25).
    assert pick["matchups"] == [
        {
            "opponent_id": CHARIZARD,
            "attack": {"type": "rock", "multiplier": 4},
            "opponent_attack": {"type": "fire", "multiplier": 0.5},
            "speed": "faster",
            "stat_total_difference": -19,
            "score": pytest.approx(2 + 1 - 0.0475 + 0.25),
            "rating": "good",
        }
    ]


@pytest.mark.usefixtures("pokedex")
def test_finds_a_counter_team_as_big_as_theirs(client: TestClient) -> None:
    team = [CHARIZARD, 3, 9, 143]

    picks = client.get("/api/counter-team", params={"pokemon_id": team}).json()

    assert len(picks) == len(team)
    assert all([each["opponent_id"] for each in pick["matchups"]] == team for pick in picks)


@pytest.mark.usefixtures("pokedex")
def test_lists_the_threats_to_a_team(client: TestClient) -> None:
    threats = client.get("/api/team-threats", params={"pokemon_id": [CHARIZARD, 3, 9]}).json()

    assert len(threats) == 12
    assert threats[0]["pokemon"]["name"] == "aerodactyl"
    assert [each["opponent_id"] for each in threats[0]["matchups"]] == [CHARIZARD, 3, 9]
    assert [each["rating"] for each in threats[0]["matchups"]] == ["good", "good", "bad"]


@pytest.mark.parametrize("path", PATHS)
@pytest.mark.parametrize(
    "params",
    [
        pytest.param({}, id="no-pokemon"),
        pytest.param({"pokemon_id": [1, 2, 3, 4, 5, 6, 7]}, id="seven-pokemon"),
        pytest.param({"pokemon_id": [6, 6]}, id="repeated"),
        pytest.param({"pokemon_id": 0}, id="not-an-id"),
        pytest.param({"pokemon_id": 2**31}, id="too-big-for-an-id"),
        pytest.param({"pokemon_id": 6, "forms": "maybe"}, id="forms-not-a-boolean"),
        pytest.param({"pokemon_id": 6, "legendaries": "maybe"}, id="legendaries-not-a-boolean"),
    ],
)
@pytest.mark.usefixtures("pokedex")
def test_refuses_a_team_that_cannot_be(
    client: TestClient, path: str, params: dict[str, Any]
) -> None:
    assert client.get(path, params=params).status_code == 422


@pytest.mark.parametrize("path", PATHS)
@pytest.mark.usefixtures("pokedex")
def test_refuses_an_id_no_pokemon_has(client: TestClient, path: str) -> None:
    response = client.get(path, params={"pokemon_id": [CHARIZARD, 99999]})

    assert (response.status_code, response.json()) == (
        422,
        {"detail": "No Pokémon has one or more of these ids."},
    )


@pytest.mark.parametrize("path", PATHS)
def test_asks_for_a_sync_when_no_type_chart_is_stored(
    client: TestClient, db_session: Session, path: str
) -> None:
    add_real_pokemon(db_session, *REAL_POKEMON)

    response = client.get(path, params={"pokemon_id": CHARIZARD})

    assert response.status_code == 503
    assert "sync" in response.json()["detail"]


def test_asks_for_a_sync_when_too_few_pokemon_are_stored(
    client: TestClient, db_session: Session
) -> None:
    # Two families to choose from, and a third Pokémon whose species isn't stored.
    add_type_chart(db_session)
    add_real_pokemon(db_session, CHARIZARD, AERODACTYL)
    db_session.add(make_pokemon(id=500, name="pokemon-500"))
    db_session.flush()

    response = client.get("/api/counter-team", params={"pokemon_id": [CHARIZARD, AERODACTYL, 500]})

    assert response.status_code == 503
    assert "sync" in response.json()["detail"]


# --- Caching ---

# A request each route answers.
ANSWERED = [
    pytest.param("/api/counter-team", {"pokemon_id": CHARIZARD}, id="counter-team"),
    pytest.param("/api/team-threats", {"pokemon_id": CHARIZARD}, id="team-threats"),
    pytest.param("/api/matchups", {"pokemon_id": GOLEM, "opponent_id": CHARIZARD}, id="matchups"),
]
# Requests each route refuses: one with an id given twice, one with an id no Pokémon has.
REFUSED = [
    pytest.param("/api/counter-team", {"pokemon_id": [6, 6]}, id="counter-team-twice"),
    pytest.param("/api/counter-team", {"pokemon_id": 99999}, id="counter-team-unknown"),
    pytest.param("/api/team-threats", {"pokemon_id": [6, 6]}, id="team-threats-twice"),
    pytest.param("/api/team-threats", {"pokemon_id": 99999}, id="team-threats-unknown"),
    pytest.param("/api/matchups", {"pokemon_id": [76, 76], "opponent_id": 6}, id="matchups-twice"),
    pytest.param("/api/matchups", {"pokemon_id": 76, "opponent_id": 99999}, id="matchups-unknown"),
]


@pytest.mark.parametrize(("path", "params"), ANSWERED)
@pytest.mark.usefixtures("pokedex")
def test_lets_browsers_and_the_cdn_cache_the_answer(
    client: TestClient, path: str, params: dict[str, Any]
) -> None:
    response = client.get(path, params=params)

    assert (response.status_code, response.headers["cache-control"]) == (
        200,
        COUNTER_TEAM_CACHE_CONTROL,
    )


@pytest.mark.parametrize(("path", "params"), ANSWERED)
@pytest.mark.usefixtures("pokedex", "running_locally")
def test_tells_browsers_not_to_keep_the_answer_when_caching_is_off(
    client: TestClient, path: str, params: dict[str, Any]
) -> None:
    response = client.get(path, params=params)

    assert (response.status_code, response.headers["cache-control"]) == (200, "no-store")


@pytest.mark.parametrize(("path", "params"), REFUSED)
@pytest.mark.usefixtures("pokedex")
def test_errors_are_not_cached(client: TestClient, path: str, params: dict[str, Any]) -> None:
    response = client.get(path, params=params)

    assert (response.status_code, response.headers["cache-control"]) == (422, "no-store")


# --- Docs ---


@pytest.mark.parametrize("path", PATHS)
def test_documents_each_parameter_and_error(openapi: dict[str, Any], path: str) -> None:
    operation = openapi["paths"][path]["get"]
    described = {param["name"] for param in operation["parameters"] if param.get("description")}

    assert described == {"pokemon_id", "forms", "legendaries"}
    assert {"200", "422", "503"} <= operation["responses"].keys()
    assert operation["description"]


# --- One team against another ---


@pytest.mark.usefixtures("pokedex")
def test_scores_one_team_against_another(client: TestClient) -> None:
    response = client.get("/api/matchups", params={"pokemon_id": GOLEM, "opponent_id": CHARIZARD})

    assert response.status_code == 200
    body = response.json()
    (member,) = body["members"]
    assert member["pokemon"]["name"] == "golem"
    # Rock is 4x against Charizard (+2), and Charizard's Fire 1/2x against Golem (+1). Golem's
    # base stat total is 495 to Charizard's 534 (0.25 * -39 / 100), and it's slower (-0.25).
    golem_on_charizard = {
        "opponent_id": CHARIZARD,
        "attack": {"type": "rock", "multiplier": 4},
        "opponent_attack": {"type": "fire", "multiplier": 0.5},
        "speed": "slower",
        "stat_total_difference": -39,
        "score": 2.6525,
        "rating": "good",
    }
    assert member["matchups"] == [golem_on_charizard]
    assert body.keys() == {"members"}


@pytest.mark.parametrize(
    "params",
    [
        pytest.param({"opponent_id": 6}, id="no-pokemon"),
        pytest.param({"pokemon_id": 76}, id="no-opponents"),
        pytest.param({"pokemon_id": [1, 2, 3, 4, 5, 6, 7], "opponent_id": 6}, id="seven-pokemon"),
        pytest.param(
            {"pokemon_id": 76, "opponent_id": [1, 2, 3, 4, 5, 6, 7]}, id="seven-opponents"
        ),
        pytest.param({"pokemon_id": [76, 76], "opponent_id": 6}, id="repeated-pokemon"),
        pytest.param({"pokemon_id": 76, "opponent_id": [6, 6]}, id="repeated-opponent"),
        pytest.param({"pokemon_id": 0, "opponent_id": 6}, id="not-an-id"),
    ],
)
@pytest.mark.usefixtures("pokedex")
def test_refuses_teams_that_cannot_be(client: TestClient, params: dict[str, Any]) -> None:
    assert client.get("/api/matchups", params=params).status_code == 422


@pytest.mark.parametrize(
    "params",
    [{"pokemon_id": [76, 99999], "opponent_id": 6}, {"pokemon_id": 76, "opponent_id": 99999}],
    ids=["ours", "theirs"],
)
@pytest.mark.usefixtures("pokedex")
def test_refuses_an_id_no_pokemon_has_on_either_team(
    client: TestClient, params: dict[str, Any]
) -> None:
    response = client.get("/api/matchups", params=params)

    assert (response.status_code, response.json()) == (
        422,
        {"detail": "No Pokémon has one or more of these ids."},
    )


def test_asks_for_a_sync_before_scoring_teams(client: TestClient, db_session: Session) -> None:
    add_real_pokemon(db_session, GOLEM, CHARIZARD)

    response = client.get("/api/matchups", params={"pokemon_id": GOLEM, "opponent_id": CHARIZARD})

    assert response.status_code == 503
    assert "sync" in response.json()["detail"]


def test_documents_scoring_teams(openapi: dict[str, Any]) -> None:
    operation = openapi["paths"]["/api/matchups"]["get"]
    described = {param["name"] for param in operation["parameters"] if param.get("description")}

    assert described == {"pokemon_id", "opponent_id"}
    assert {"200", "422", "503"} <= operation["responses"].keys()
    assert operation["description"]
