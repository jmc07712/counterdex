from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.accounts import service as accounts
from app.accounts.types import SignedIn
from app.api.main import app
from app.api.routes.teams import conflict_detail
from app.api.session_cookie import session_cookie_name
from app.teams import service
from app.teams.enums import TeamConflictReason
from tests.support.accounts import ASH
from tests.support.teams import (
    add_eevee_family,
    add_species_pokemon,
    backdate,
    make_team,
    wait_until_a_session_waits_for_a_lock,
)

TEAM_ID = "00000000-0000-4000-8000-000000000001"
TEAM = f"/api/teams/{TEAM_ID}"
FAMILY_ON_TEAM = {
    "detail": (
        "The team already has a Pokémon from this evolution family. Replace that one, or choose "
        "a Pokémon from another family."
    ),
    "reason": "family_on_team",
}
TEAM_FULL = {"detail": "The team already has six Pokémon. Remove one first.", "reason": "team_full"}


def member_ids(team: dict[str, Any]) -> list[int]:
    return [member["pokemon"]["id"] for member in team["members"]]


def test_creating_or_changing_a_team_needs_signing_in(client: TestClient) -> None:
    assert client.put(TEAM, json={"name": "Fire"}).status_code == 401
    assert client.patch(TEAM, json={"name": "Rain"}).status_code == 401


@pytest.mark.usefixtures("charmander_family")
def test_anyone_can_see_teams_without_signing_in(
    client: TestClient, db_session: Session, misty: SignedIn
) -> None:
    team = make_team(db_session, misty.user.id, 4)

    shown = client.get(f"/api/teams/{team.id}")

    assert (shown.status_code, shown.json()["owner"]) == (200, {"username": "misty"})
    assert client.get("/api/users/misty/teams").json() == [shown.json()]
    assert client.get("/api/teams").json() == {"items": [shown.json()], "next_cursor": None}


@pytest.mark.usefixtures("charmander_family")
def test_creating_a_team_twice_makes_one(ash_client: TestClient, db_session: Session) -> None:
    add_species_pokemon(db_session, 201)

    first = ash_client.put(TEAM, json={"name": "Fire", "pokemon_ids": [4, 201]})
    again = ash_client.put(TEAM, json={"name": "Fire", "pokemon_ids": [4, 201]})

    assert (first.status_code, again.status_code) == (201, 200)
    assert again.json() == first.json()
    assert member_ids(first.json()) == [4, 201]
    assert [team["id"] for team in ash_client.get("/api/users/ash/teams").json()] == [
        first.json()["id"]
    ]


def test_a_team_shows_its_owner_by_username_only(ash_client: TestClient) -> None:
    team = ash_client.put(TEAM, json={"name": "Fire"}).json()

    assert team["owner"] == {"username": "ash"}


@pytest.mark.usefixtures("charmander_family")
def test_a_team_shows_its_members(ash_client: TestClient) -> None:
    team = ash_client.put(TEAM, json={"name": "Fire", "pokemon_ids": [10034]}).json()

    assert team["members"] == [
        {
            "position": 0,
            "pokemon": team["members"][0]["pokemon"]
            | {"id": 10034, "species_id": 6, "family_id": 2},
            "removed_at": None,
        }
    ]
    assert ash_client.get(TEAM).json() == team


def test_a_team_no_one_has_is_not_found(ash_client: TestClient) -> None:
    response = ash_client.get(TEAM)

    assert (response.status_code, response.json()) == (404, {"detail": "No team has this id."})
    assert ash_client.patch(TEAM, json={"name": "Rain"}).status_code == 404


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        pytest.param("PATCH", "", {"name": "Mine"}, id="rename"),
        pytest.param("DELETE", "", None, id="delete"),
        pytest.param("POST", "/members", {"pokemon_id": 6}, id="add"),
        pytest.param("PUT", "/members/4", {"pokemon_id": 6}, id="replace"),
        pytest.param("DELETE", "/members/4", None, id="remove"),
        pytest.param("PUT", "/order", {"pokemon_ids": [201, 4]}, id="reorder"),
    ],
)
@pytest.mark.usefixtures("charmander_family")
def test_only_a_teams_owner_can_change_it(
    ash_client: TestClient,
    db_session: Session,
    misty: SignedIn,
    method: str,
    path: str,
    body: dict[str, Any] | None,
) -> None:
    add_species_pokemon(db_session, 201)
    url = f"/api/teams/{make_team(db_session, misty.user.id, 4, 201).id}"
    before = ash_client.get(url).json()

    response = ash_client.request(method, f"{url}{path}", json=body)

    assert (response.status_code, response.json()) == (
        403,
        {"detail": "Only the team's owner can change it."},
    )
    assert ash_client.get(url).json() == before


def test_an_id_another_user_has_is_taken(
    ash_client: TestClient, db_session: Session, misty: SignedIn
) -> None:
    team = make_team(db_session, misty.user.id)

    taken = ash_client.put(f"/api/teams/{team.id}", json={"name": "Mine"})

    assert (taken.status_code, taken.json()) == (
        409,
        {
            "detail": "Another team already has this id. Choose a new UUID.",
            "reason": "team_id_taken",
        },
    )


@pytest.mark.usefixtures("charmander_family")
def test_a_failed_create_leaves_no_team(ash_client: TestClient) -> None:
    response = ash_client.put(TEAM, json={"name": "Fire", "pokemon_ids": [4, 6]})

    assert (response.status_code, response.json()) == (409, FAMILY_ON_TEAM)
    assert ash_client.get("/api/users/ash/teams").json() == []


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
def test_adds_replaces_removes_and_reorders(ash_client: TestClient, db_session: Session) -> None:
    add_species_pokemon(db_session, 201)
    ash_client.put(TEAM, json={"name": "Fire", "pokemon_ids": [4]})

    added = ash_client.post(f"{TEAM}/members", json={"pokemon_id": 201})
    assert member_ids(added.json()) == [4, 201]
    # Charizard takes Charmander's slot: they're one family, so that's allowed.
    replaced = ash_client.put(f"{TEAM}/members/4", json={"pokemon_id": 6})
    assert member_ids(replaced.json()) == [6, 201]
    reordered = ash_client.put(f"{TEAM}/order", json={"pokemon_ids": [201, 6]})
    assert member_ids(reordered.json()) == [201, 6]
    assert member_ids(ash_client.delete(f"{TEAM}/members/201").json()) == [6]


@pytest.mark.usefixtures("charmander_family")
def test_a_conflict_says_why(ash_client: TestClient) -> None:
    ash_client.put(TEAM, json={"name": "Fire", "pokemon_ids": [6]})

    response = ash_client.post(f"{TEAM}/members", json={"pokemon_id": 4})

    assert (response.status_code, response.json()) == (409, FAMILY_ON_TEAM)


def test_a_full_team_says_to_remove_one_first(ash_client: TestClient, db_session: Session) -> None:
    add_species_pokemon(db_session, 201, 202, 203, 204, 205, 206, 207)
    ash_client.put(TEAM, json={"name": "Six", "pokemon_ids": [201, 202, 203, 204, 205, 206]})

    response = ash_client.post(f"{TEAM}/members", json={"pokemon_id": 207})

    assert (response.status_code, response.json()) == (409, TEAM_FULL)


def test_branches_of_one_family_cant_share_a_team(
    ash_client: TestClient, db_session: Session
) -> None:
    add_eevee_family(db_session)

    response = ash_client.put(TEAM, json={"name": "Eevees", "pokemon_ids": [134, 135]})

    assert (response.status_code, response.json()) == (409, FAMILY_ON_TEAM)


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
def test_an_out_of_date_order_is_a_conflict(ash_client: TestClient, db_session: Session) -> None:
    add_species_pokemon(db_session, 201)
    ash_client.put(TEAM, json={"name": "Fire", "pokemon_ids": [4, 201]})

    response = ash_client.put(f"{TEAM}/order", json={"pokemon_ids": [201]})

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


def test_a_change_waits_for_one_in_progress_then_sees_it(
    committing_sessions: sessionmaker[Session], migrated_engine: Engine
) -> None:
    # A real request on its own connection: it finds the team full only if the route locks the
    # team before reading its members.
    with committing_sessions() as session:
        add_species_pokemon(session, 201, 202, 203, 204, 205, 206, 207)
        ash = accounts.sign_up(session, ASH)
        team = make_team(session, ash.user.id, 201, 202, 203, 204, 205)
        session.commit()

    with (
        TestClient(app, base_url="https://testserver") as client,
        ThreadPoolExecutor(1) as pool,
        committing_sessions() as first,
    ):
        service.add_member(first, service.lock_owned_team(first, ash.user.id, team.id), 206)
        client.cookies.set(session_cookie_name(), ash.token)
        add = pool.submit(client.post, f"/api/teams/{team.id}/members", json={"pokemon_id": 207})
        wait_until_a_session_waits_for_a_lock(migrated_engine)
        first.commit()
        response = add.result(timeout=10)

    assert (response.status_code, response.json()) == (409, TEAM_FULL)


@pytest.mark.usefixtures("charmander_family")
def test_lists_a_users_teams_most_recently_changed_first(
    ash_client: TestClient, db_session: Session, ash: SignedIn, misty: SignedIn
) -> None:
    older = make_team(db_session, ash.user.id, name="Older")
    make_team(db_session, ash.user.id, 4, name="Newer")
    make_team(db_session, misty.user.id, 5, name="Misty's")
    ash_client.patch(f"/api/teams/{older.id}", json={"name": "Renamed"})

    response = ash_client.get("/api/users/ASH/teams")

    assert response.status_code == 200
    assert [team["name"] for team in response.json()] == ["Renamed", "Newer"]
    assert response.json()[0]["members"] == []


def test_a_username_no_one_has_is_not_found(client: TestClient) -> None:
    response = client.get("/api/users/brock/teams")

    assert (response.status_code, response.json()) == (
        404,
        {"detail": "No user has this username."},
    )


@pytest.mark.parametrize(
    "username",
    [
        pytest.param("%00", id="nul-character"),
        pytest.param("x" * 33, id="too-long"),
    ],
)
def test_rejects_usernames_that_cant_exist(client: TestClient, username: str) -> None:
    response = client.get(f"/api/users/{username}/teams")

    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["path", "username"]


@pytest.mark.usefixtures("charmander_family")
def test_lists_everyones_teams_with_pokemon_newest_first(
    client: TestClient, db_session: Session, ash: SignedIn, misty: SignedIn
) -> None:
    yesterday = make_team(db_session, misty.user.id, 4, name="Yesterday")
    last_week = make_team(db_session, ash.user.id, 5, name="Last week")
    make_team(db_session, ash.user.id, 6, name="Today")
    make_team(db_session, ash.user.id, name="Empty")
    backdate(db_session, yesterday.id, timedelta(days=1))
    backdate(db_session, last_week.id, timedelta(days=7))

    page = client.get("/api/teams").json()

    assert [(team["name"], team["owner"]["username"]) for team in page["items"]] == [
        ("Today", "ash"),
        ("Yesterday", "misty"),
        ("Last week", "ash"),
    ]
    assert page["next_cursor"] is None


@pytest.mark.usefixtures("charmander_family")
def test_pages_through_everyones_teams(
    client: TestClient, db_session: Session, ash: SignedIn
) -> None:
    # Teams made in one transaction share a created_at, so their ids decide their order.
    teams = [make_team(db_session, ash.user.id, 4) for _ in range(4)]
    backdate(db_session, teams[0].id, timedelta(days=1))
    everyone = client.get("/api/teams").json()["items"]

    first = client.get("/api/teams", params={"limit": 2}).json()
    second = client.get("/api/teams", params={"limit": 2, "cursor": first["next_cursor"]}).json()

    tied = [team["id"] for team in everyone[:3]]
    assert (tied, everyone[3]["id"]) == (sorted(tied, reverse=True), str(teams[0].id))
    assert first["next_cursor"] == first["items"][-1]["id"]
    assert second["next_cursor"] is None
    assert first["items"] + second["items"] == everyone


@pytest.mark.usefixtures("charmander_family")
def test_a_cursor_no_team_has_gives_an_empty_page(
    client: TestClient, db_session: Session, ash: SignedIn
) -> None:
    make_team(db_session, ash.user.id, 4)

    response = client.get("/api/teams", params={"cursor": TEAM_ID})

    assert (response.status_code, response.json()) == (200, {"items": [], "next_cursor": None})


@pytest.mark.usefixtures("charmander_family")
def test_searches_everyones_teams(
    client: TestClient, db_session: Session, ash: SignedIn, misty: SignedIn
) -> None:
    make_team(db_session, ash.user.id, 4, name="Rain dance")
    make_team(db_session, misty.user.id, 5, name="Sun")

    by_name = client.get("/api/teams", params={"q": "Rain"}).json()
    by_owner = client.get("/api/teams", params={"q": "misty"}).json()
    by_pokemon = client.get("/api/teams", params={"q": "charmel"}).json()

    assert [
        [team["name"] for team in page["items"]] for page in (by_name, by_owner, by_pokemon)
    ] == [
        ["Rain dance"],
        ["Sun"],
        ["Sun"],
    ]


@pytest.mark.usefixtures("charmander_family")
def test_pages_through_a_search(client: TestClient, db_session: Session, ash: SignedIn) -> None:
    for hours, name in enumerate(["Fire 1", "Water 2", "Fire 3", "Water 4", "Fire 5"], start=1):
        team = make_team(db_session, ash.user.id, 4, name=name)
        backdate(db_session, team.id, timedelta(hours=hours))

    first = client.get("/api/teams", params={"q": "fire", "limit": 2}).json()
    second = client.get(
        "/api/teams", params={"q": "fire", "limit": 2, "cursor": first["next_cursor"]}
    ).json()

    assert [team["name"] for team in first["items"] + second["items"]] == [
        "Fire 1",
        "Fire 3",
        "Fire 5",
    ]
    assert (first["next_cursor"], second["next_cursor"]) == (first["items"][-1]["id"], None)


def test_documents_what_a_search_matches(openapi: dict[str, Any]) -> None:
    operation = openapi["paths"]["/api/teams"]["get"]
    search = next(param for param in operation["parameters"] if param["name"] == "q")

    assert "username" in search["description"]
    assert "Pokémon" in search["description"]


@pytest.mark.parametrize("limit", [1, 60])
def test_accepts_page_sizes_from_1_to_60(client: TestClient, limit: int) -> None:
    assert client.get("/api/teams", params={"limit": limit}).status_code == 200


@pytest.mark.parametrize(
    "params",
    [
        pytest.param({"limit": 0}, id="limit-0"),
        pytest.param({"limit": 61}, id="limit-61"),
        pytest.param({"cursor": "6"}, id="cursor-not-a-uuid"),
        pytest.param({"q": ""}, id="q-empty"),
        pytest.param({"q": "   "}, id="q-blank"),
        pytest.param({"q": "x" * 51}, id="q-too-long"),
    ],
)
def test_rejects_bad_pages(client: TestClient, params: dict[str, Any]) -> None:
    assert client.get("/api/teams", params=params).status_code == 422


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
