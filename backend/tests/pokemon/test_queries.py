from datetime import UTC, datetime

import pytest
from sqlalchemy.orm import Session

from app.pokemon.queries import cdn_sprite_url, list_pokemon
from app.pokemon.schemas import PokemonPage
from tests.support.pokemon import add_pokemon, make_pokemon

GITHUB_SPRITE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png"
CDN_SPRITE = "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/25.png"


def ids(page: PokemonPage) -> list[int]:
    return [pokemon.id for pokemon in page.items]


def test_lists_pokemon_in_pokedex_order(db_session: Session) -> None:
    # Added out of order, and alphabetical order would put eevee first.
    db_session.add_all([make_pokemon(id=133, name="eevee"), make_pokemon(id=25, name="pikachu")])
    db_session.flush()

    page = list_pokemon(db_session, limit=10)

    assert [pokemon.name for pokemon in page.items] == ["pikachu", "eevee"]


def test_hides_pokemon_pokeapi_no_longer_lists(db_session: Session) -> None:
    db_session.add_all(
        [
            make_pokemon(id=25, name="pikachu"),
            make_pokemon(id=6, name="charizard", removed_at=datetime(2026, 10, 9, tzinfo=UTC)),
        ]
    )
    db_session.flush()

    assert ids(list_pokemon(db_session, limit=10)) == [25]


def test_lists_nothing_before_the_first_sync(db_session: Session) -> None:
    assert list_pokemon(db_session, limit=10) == PokemonPage(items=[], next_cursor=None)


def test_points_to_the_next_page_when_there_is_one(db_session: Session) -> None:
    add_pokemon(db_session, 1, 4, 7)

    page = list_pokemon(db_session, limit=2)

    assert (ids(page), page.next_cursor) == ([1, 4], 4)


def test_continues_after_the_cursor(db_session: Session) -> None:
    add_pokemon(db_session, 1, 4, 7)

    page = list_pokemon(db_session, limit=2, cursor=4)

    assert (ids(page), page.next_cursor) == ([7], None)


def test_has_no_next_page_when_the_last_page_is_exactly_full(db_session: Session) -> None:
    add_pokemon(db_session, 1, 4)

    assert list_pokemon(db_session, limit=2).next_cursor is None


@pytest.mark.parametrize(
    ("stored", "served"),
    [
        (GITHUB_SPRITE, CDN_SPRITE),
        ("https://example.com/sprite.png", "https://example.com/sprite.png"),
        (None, None),
    ],
)
def test_only_sprites_hosted_on_github_are_moved_to_the_cdn(
    stored: str | None, served: str | None
) -> None:
    assert cdn_sprite_url(stored) == served
