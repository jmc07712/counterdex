import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.support.pokemon import add_pokemon, make_pokemon


def test_serves_a_page_of_pokemon_with_their_public_fields(
    client: TestClient, db_session: Session
) -> None:
    db_session.add(make_pokemon())
    db_session.flush()

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
                "sprite_url": "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/130.png",
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


# Pokémon ids are 32-bit Postgres integers, so 2**31 can't be one.
@pytest.mark.parametrize("cursor", ["0", str(2**31), "pikachu"])
def test_rejects_cursors_that_cannot_be_a_pokemon_id(client: TestClient, cursor: str) -> None:
    assert client.get("/api/pokemon", params={"cursor": cursor}).status_code == 422


def test_can_be_cached_by_browsers_and_the_cdn(client: TestClient) -> None:
    cache_control = client.get("/api/pokemon").headers["cache-control"]

    assert cache_control == "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"


def test_errors_are_not_cached(client: TestClient) -> None:
    response = client.get("/api/pokemon", params={"limit": 0})

    assert "cache-control" not in response.headers


def test_documents_every_type_a_pokemon_can_have(client: TestClient) -> None:
    schemas = client.get("/api/openapi.json").json()["components"]["schemas"]

    assert schemas["PokemonType"]["enum"] == [
        "normal",
        "fighting",
        "flying",
        "poison",
        "ground",
        "rock",
        "bug",
        "ghost",
        "steel",
        "fire",
        "water",
        "grass",
        "electric",
        "psychic",
        "ice",
        "dragon",
        "dark",
        "fairy",
    ]


def test_filters_by_name_type_and_form(client: TestClient, db_session: Session) -> None:
    db_session.add_all(
        [
            make_pokemon(id=6, name="charizard", types=["fire", "flying"]),
            make_pokemon(id=146, name="moltres", types=["fire", "flying"]),
            make_pokemon(
                id=10034, name="charizard-mega-x", types=["fire", "dragon"], is_default=False
            ),
        ]
    )
    db_session.flush()

    params = {"q": "char", "type": ["fire", "flying"], "forms": "false"}
    page = client.get("/api/pokemon", params=params).json()

    assert [pokemon["name"] for pokemon in page["items"]] == ["charizard"]


@pytest.mark.parametrize(
    "params",
    [{"type": "shadow"}, {"type": ["fire", "water", "grass"]}, {"q": ""}, {"forms": "maybe"}],
)
def test_rejects_filters_that_cannot_match(
    client: TestClient, params: dict[str, str | list[str]]
) -> None:
    assert client.get("/api/pokemon", params=params).status_code == 422


def test_documents_each_filter(client: TestClient) -> None:
    operation = client.get("/api/openapi.json").json()["paths"]["/api/pokemon"]["get"]
    described = {param["name"] for param in operation["parameters"] if param.get("description")}

    assert {"q", "type", "forms", "limit", "cursor"} <= described
