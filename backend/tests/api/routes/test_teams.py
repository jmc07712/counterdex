from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.accounts.types import SignedIn
from app.api.routes.teams import conflict_detail
from app.teams.enums import TeamConflictReason
from tests.support.teams import add_species_pokemon, make_team

TEAM = "/api/teams/00000000-0000-4000-8000-000000000001"
SPECIES_ON_TEAM = {
    "detail": "The team already has this Pokémon's species, in this or another form.",
    "reason": "species_on_team",
}


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
    assert (taken.status_code, taken.json()) == (
        409,
        {
            "detail": "Another team already has this id. Choose a new UUID.",
            "reason": "team_id_taken",
        },
    )


@pytest.mark.usefixtures("charmander_family")
def test_a_failed_create_leaves_no_team(ash_client: TestClient) -> None:
    response = ash_client.put(TEAM, json={"name": "Fire", "pokemon_ids": [6, 10034]})

    assert (response.status_code, response.json()) == (409, SPECIES_ON_TEAM)
    assert ash_client.get("/api/teams").json() == []


@pytest.mark.parametrize(
    ("body", "field"),
    [
        pytest.param({"name": "   "}, "name", id="blank-name"),
        pytest.param({"name": "x" * 41}, "name", id="long-name"),
        pytest.param(
            {"name": "Fire", "pokemon_ids": [201, 202, 203, 204, 205, 206, 207]},
            "pokemon_ids",
            id="seven",
        ),
        pytest.param({"name": "Fire", "pokemon_ids": [201, 201]}, "pokemon_ids", id="twice"),
    ],
)
def test_rejects_invalid_teams(
    ash_client: TestClient, db_session: Session, body: dict[str, Any], field: str
) -> None:
    # Stored, so these Pokémon are valid and only the team's shape can be what's wrong.
    add_species_pokemon(db_session, 201, 202, 203, 204, 205, 206, 207)

    response = ash_client.put(TEAM, json=body)

    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", field]


def test_an_unknown_pokemon_is_invalid(ash_client: TestClient) -> None:
    response = ash_client.put(TEAM, json={"name": "Fire", "pokemon_ids": [9999]})

    assert (response.status_code, response.json()) == (
        422,
        {"detail": "No Pokémon has this id, or a sync hasn't stored its species yet."},
    )


def test_a_pokemon_given_twice_says_each_can_be_on_a_team_only_once(
    ash_client: TestClient, db_session: Session
) -> None:
    add_species_pokemon(db_session, 201)

    response = ash_client.put(TEAM, json={"name": "Fire", "pokemon_ids": [201, 201]})

    assert response.status_code == 422
    assert response.json()["detail"][0]["msg"] == (
        "Value error, Each Pokémon can be on a team only once."
    )


def test_renames_and_deletes(ash_client: TestClient) -> None:
    ash_client.put(TEAM, json={"name": "Fire"})

    renamed = ash_client.patch(TEAM, json={"name": "  Rain  "})
    assert (renamed.status_code, renamed.json()["name"]) == (200, "Rain")

    assert ash_client.delete(TEAM).status_code == 204
    assert ash_client.get(TEAM).status_code == 404


def test_team_responses_are_never_cached(ash_client: TestClient) -> None:
    assert ash_client.get("/api/teams").headers["cache-control"] == "no-store"


@pytest.mark.usefixtures("charmander_family")
def test_adds_replaces_removes_and_reorders(ash_client: TestClient) -> None:
    ash_client.put(TEAM, json={"name": "Fire", "pokemon_ids": [4]})

    assert member_ids(ash_client.post(f"{TEAM}/members", json={"pokemon_id": 5}).json()) == [4, 5]
    assert member_ids(ash_client.put(f"{TEAM}/members/4", json={"pokemon_id": 6}).json()) == [6, 5]
    assert member_ids(ash_client.put(f"{TEAM}/order", json={"pokemon_ids": [5, 6]}).json()) == [
        5,
        6,
    ]
    assert member_ids(ash_client.delete(f"{TEAM}/members/5").json()) == [6]


@pytest.mark.usefixtures("charmander_family")
def test_a_conflict_says_why(ash_client: TestClient) -> None:
    ash_client.put(TEAM, json={"name": "Fire", "pokemon_ids": [6]})

    response = ash_client.post(f"{TEAM}/members", json={"pokemon_id": 10034})

    assert (response.status_code, response.json()) == (409, SPECIES_ON_TEAM)


@pytest.mark.parametrize("reason", list(TeamConflictReason))
def test_each_conflict_reason_has_its_own_sentence(reason: TeamConflictReason) -> None:
    detail = conflict_detail(reason)

    assert detail.endswith(".")
    assert reason.value not in detail


@pytest.mark.usefixtures("charmander_family")
def test_a_pokemon_not_on_the_team_is_not_found(ash_client: TestClient) -> None:
    ash_client.put(TEAM, json={"name": "Fire", "pokemon_ids": [4]})

    assert ash_client.delete(f"{TEAM}/members/5").status_code == 404
    assert ash_client.put(f"{TEAM}/members/5", json={"pokemon_id": 6}).status_code == 404


@pytest.mark.usefixtures("charmander_family")
def test_an_out_of_date_order_is_a_conflict(ash_client: TestClient) -> None:
    ash_client.put(TEAM, json={"name": "Fire", "pokemon_ids": [4, 5]})

    response = ash_client.put(f"{TEAM}/order", json={"pokemon_ids": [5]})

    assert (response.status_code, response.json()) == (
        409,
        {
            "detail": (
                "The order must list every Pokémon on the team, each once. Get the team again: "
                "it may have changed."
            ),
            "reason": "order_out_of_date",
        },
    )


@pytest.mark.usefixtures("charmander_family")
def test_previews_without_signing_in(client: TestClient) -> None:
    response = client.get("/api/teams/preview", params={"pokemon_id": [6, 4]})

    assert response.status_code == 200
    assert [member["pokemon"]["id"] for member in response.json()] == [6, 4]


def test_previewing_no_pokemon_gives_no_members(client: TestClient) -> None:
    response = client.get("/api/teams/preview")

    assert (response.status_code, response.json()) == (200, [])


def test_a_preview_holds_up_to_six(client: TestClient) -> None:
    response = client.get("/api/teams/preview", params={"pokemon_id": [1, 2, 3, 4, 5, 6, 7]})

    assert response.status_code == 422
