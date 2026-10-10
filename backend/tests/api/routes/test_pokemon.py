from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.constants import POKEMON_CACHE_CONTROL
from app.sync.enums import ChangeKind
from tests.support.pokemon import GYARADOS_CDN_SPRITE, LEVEL_16, add_pokemon, make_pokemon
from tests.support.sync import add_change, gyarados_snapshot

# Pokémon ids are 32-bit Postgres integers, so 2**31 can't be one.
NOT_POKEMON_IDS = ["0", str(2**31), "pikachu"]


@pytest.mark.usefixtures("gyarados")
def test_serves_a_page_of_pokemon_with_their_public_fields(client: TestClient) -> None:
    response = client.get("/api/pokemon")

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {
                "id": 130,
                "name": "gyarados",
                "types": ["water", "flying"],
                "stats": {
                    "hp": 95,
                    "attack": 125,
                    "defense": 79,
                    "sp_attack": 60,
                    "sp_defense": 100,
                    "speed": 81,
                },
                "sprite_url": GYARADOS_CDN_SPRITE,
                "is_default": True,
                "form": None,
            }
        ],
        "next_cursor": None,
    }


def test_serves_the_page_after_the_cursor(client: TestClient, db_session: Session) -> None:
    add_pokemon(db_session, 1, 4, 7)

    page = client.get("/api/pokemon", params={"limit": 1, "cursor": 1}).json()

    assert ([pokemon["id"] for pokemon in page["items"]], page["next_cursor"]) == ([4], 4)


def test_serves_50_pokemon_per_page_by_default(client: TestClient, db_session: Session) -> None:
    add_pokemon(db_session, *range(1, 52))

    page = client.get("/api/pokemon").json()

    assert (len(page["items"]), page["next_cursor"]) == (50, 50)


@pytest.mark.parametrize("limit", [1, 200])
def test_accepts_page_sizes_from_1_to_200(client: TestClient, limit: int) -> None:
    assert client.get("/api/pokemon", params={"limit": limit}).status_code == 200


@pytest.mark.parametrize("limit", [0, 201])
def test_rejects_page_sizes_outside_1_to_200(client: TestClient, limit: int) -> None:
    assert client.get("/api/pokemon", params={"limit": limit}).status_code == 422


@pytest.mark.parametrize("cursor", [1, 2**31 - 1])
def test_accepts_any_cursor_a_pokemon_id_can_hold(client: TestClient, cursor: int) -> None:
    assert client.get("/api/pokemon", params={"cursor": cursor}).status_code == 200


@pytest.mark.parametrize("cursor", NOT_POKEMON_IDS)
def test_rejects_cursors_that_cannot_be_a_pokemon_id(client: TestClient, cursor: str) -> None:
    assert client.get("/api/pokemon", params={"cursor": cursor}).status_code == 422


def test_filters_by_name_type_and_form(client: TestClient, db_session: Session) -> None:
    # Each filter rules out one of these: moltres the name, charmander the types, and
    # charizard-mega-y the form.
    db_session.add_all(
        [
            make_pokemon(id=4, name="charmander", types=["fire"]),
            make_pokemon(id=6, name="charizard", types=["fire", "flying"]),
            make_pokemon(id=146, name="moltres", types=["fire", "flying"]),
            make_pokemon(
                id=10035, name="charizard-mega-y", types=["fire", "flying"], is_default=False
            ),
        ]
    )
    db_session.flush()

    params = {"q": "char", "type": ["fire", "flying"], "forms": "default"}
    page = client.get("/api/pokemon", params=params).json()

    assert [pokemon["name"] for pokemon in page["items"]] == ["charizard"]


@pytest.mark.parametrize(
    "params",
    [
        {"type": "shadow"},
        {"type": ["fire", "water", "grass"]},
        {"q": ""},
        {"q": "x" * 51},
        {"forms": "false"},
    ],
)
def test_rejects_filters_that_cannot_match(
    client: TestClient, params: dict[str, str | list[str]]
) -> None:
    assert client.get("/api/pokemon", params=params).status_code == 422


def test_documents_each_filter(openapi: dict[str, Any]) -> None:
    operation = openapi["paths"]["/api/pokemon"]["get"]
    described = {param["name"] for param in operation["parameters"] if param.get("description")}

    assert {"q", "type", "forms", "limit", "cursor"} <= described


# --- GET /api/pokemon/{id} ---


@pytest.mark.usefixtures("charmander_family")
def test_serves_a_pokemons_details(client: TestClient) -> None:
    response = client.get("/api/pokemon/6")

    assert response.status_code == 200
    charizard = response.json()
    assert (charizard["pokemon"]["name"], charizard["removed_at"]) == ("charizard", None)
    assert charizard["species"] == {"id": 6, "name": "charizard", "genus": "Flame Pokémon"}
    assert [form["id"] for form in charizard["forms"]] == [6, 10034]
    charmander = charizard["evolution"]
    assert (charmander["species"]["name"], charmander["methods"]) == ("charmander", [])
    assert [stage["methods"] for stage in charmander["evolves_to"]] == [
        [LEVEL_16.model_dump(mode="json")]
    ]


@pytest.mark.parametrize("path", ["/api/pokemon/999", "/api/pokemon/999/changes"])
def test_says_when_no_pokemon_has_the_id(client: TestClient, path: str) -> None:
    response = client.get(path)

    assert (response.status_code, response.json()) == (404, {"detail": "No Pokémon has this id."})


@pytest.mark.parametrize("path", ["/api/pokemon/{}", "/api/pokemon/{}/changes"])
@pytest.mark.parametrize("pokemon_id", NOT_POKEMON_IDS)
def test_rejects_ids_that_cannot_be_a_pokemons(
    client: TestClient, path: str, pokemon_id: str
) -> None:
    assert client.get(path.format(pokemon_id)).status_code == 422


# --- GET /api/pokemon/{id}/changes ---


@pytest.mark.usefixtures("gyarados")
def test_serves_a_pokemons_changes(client: TestClient, db_session: Session) -> None:
    add_change(
        db_session,
        130,
        ChangeKind.REMOVED,
        before=gyarados_snapshot(),
        after=None,
        detected_at=datetime(2026, 10, 10, 9, tzinfo=UTC),
    )

    response = client.get("/api/pokemon/130/changes")

    assert response.status_code == 200
    (removal,) = response.json()
    assert (removal["kind"], removal["detected_at"], removal["after"]) == (
        "removed",
        "2026-10-10T09:00:00Z",
        None,
    )
    # The snapshot reads as the Pokémon it was, in the same shape as everywhere else.
    assert removal["before"] == client.get("/api/pokemon/130").json()["pokemon"]


@pytest.mark.usefixtures("gyarados")
def test_serves_no_changes_for_a_pokemon_no_sync_has_changed(client: TestClient) -> None:
    assert client.get("/api/pokemon/130/changes").json() == []


# --- Caching ---


@pytest.mark.parametrize("path", ["/api/pokemon", "/api/pokemon/130", "/api/pokemon/130/changes"])
@pytest.mark.usefixtures("gyarados")
def test_lets_browsers_and_the_cdn_cache_pokemon(client: TestClient, path: str) -> None:
    assert client.get(path).headers["cache-control"] == POKEMON_CACHE_CONTROL


@pytest.mark.parametrize(
    "path", ["/api/pokemon?limit=0", "/api/pokemon/999", "/api/pokemon/999/changes"]
)
def test_errors_are_not_cached(client: TestClient, path: str) -> None:
    assert "cache-control" not in client.get(path).headers
