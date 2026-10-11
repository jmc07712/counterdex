from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.accounts.types import SignedIn
from tests.support.teams import make_team

TEAM = "/api/teams/00000000-0000-4000-8000-000000000001"


def member_ids(team: dict[str, Any]) -> list[int]:
    return [member["pokemon"]["id"] for member in team["members"]]


def test_teams_need_signing_in(client: TestClient) -> None:
    assert client.get("/api/teams").status_code == 401
    assert client.put(TEAM, json={"name": "Fire"}).status_code == 401


@pytest.mark.usefixtures("charmander_family")
def test_creating_a_team_twice_makes_one(ash_client: TestClient) -> None:
    first = ash_client.put(TEAM, json={"name": "Fire", "pokemon_ids": [4, 6]})
    again = ash_client.put(TEAM, json={"name": "Fire", "pokemon_ids": [4, 6]})

    assert (first.status_code, again.status_code) == (201, 200)
    assert again.json() == first.json()
    assert member_ids(first.json()) == [4, 6]
    assert [team["id"] for team in ash_client.get("/api/teams").json()] == [first.json()["id"]]


@pytest.mark.usefixtures("charmander_family")
def test_a_team_shows_its_members_and_their_relatives(ash_client: TestClient) -> None:
    team = ash_client.put(TEAM, json={"name": "Fire", "pokemon_ids": [4, 6]}).json()

    assert team["members"][0] == {
        "position": 0,
        "pokemon": team["members"][0]["pokemon"] | {"id": 4, "species_id": 4},
        "removed_at": None,
        "related_pokemon_ids": [6],
    }
    assert ash_client.get(TEAM).json() == team


def test_another_users_team_is_not_found(
    ash_client: TestClient, db_session: Session, misty: SignedIn
) -> None:
    team = make_team(db_session, misty.user.id)
    url = f"/api/teams/{team.id}"

    assert ash_client.get(url).status_code == 404
    assert ash_client.patch(url, json={"name": "Mine"}).status_code == 404
    assert ash_client.delete(url).status_code == 404
    taken = ash_client.put(url, json={"name": "Mine"})
    assert (taken.status_code, taken.json()) == (409, {"reason": "team_id_taken"})


@pytest.mark.usefixtures("charmander_family")
def test_a_failed_create_leaves_no_team(ash_client: TestClient) -> None:
    response = ash_client.put(TEAM, json={"name": "Fire", "pokemon_ids": [6, 10034]})

    assert (response.status_code, response.json()) == (409, {"reason": "species_on_team"})
    assert ash_client.get("/api/teams").json() == []


@pytest.mark.parametrize(
    "body",
    [
        pytest.param({"name": "   "}, id="blank-name"),
        pytest.param({"name": "x" * 41}, id="long-name"),
        pytest.param({"name": "Fire", "pokemon_ids": [1, 2, 3, 4, 5, 6, 7]}, id="seven"),
        pytest.param({"name": "Fire", "pokemon_ids": [4, 4]}, id="twice"),
    ],
)
def test_rejects_invalid_teams(ash_client: TestClient, body: dict[str, Any]) -> None:
    assert ash_client.put(TEAM, json=body).status_code == 422


def test_an_unknown_pokemon_is_invalid(ash_client: TestClient) -> None:
    response = ash_client.put(TEAM, json={"name": "Fire", "pokemon_ids": [9999]})

    assert (response.status_code, response.json()) == (422, {"detail": "No Pokémon has this id."})


def test_renames_and_deletes(ash_client: TestClient) -> None:
    ash_client.put(TEAM, json={"name": "Fire"})

    renamed = ash_client.patch(TEAM, json={"name": "  Rain  "})
    assert (renamed.status_code, renamed.json()["name"]) == (200, "Rain")

    assert ash_client.delete(TEAM).status_code == 204
    assert ash_client.get(TEAM).status_code == 404


def test_team_responses_are_never_cached(ash_client: TestClient) -> None:
    assert ash_client.get("/api/teams").headers["cache-control"] == "no-store"
