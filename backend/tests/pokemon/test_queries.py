from datetime import UTC, datetime

import pytest
from sqlalchemy.orm import Session

from app.pokemon.enums import PokemonType
from app.pokemon.queries import cdn_sprite_url, list_pokemon
from app.pokemon.schemas import PokemonPage, PokemonQuery
from tests.support.pokemon import add_pokemon, make_pokemon

GITHUB_SPRITE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png"
CDN_SPRITE = "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/25.png"


def ids(page: PokemonPage) -> list[int]:
    return [pokemon.id for pokemon in page.items]


def names(page: PokemonPage) -> list[str]:
    return [pokemon.name for pokemon in page.items]


def add_pokedex(session: Session) -> None:
    """A few Pokémon with differing names, types and forms."""
    session.add_all(
        [
            make_pokemon(id=4, name="charmander", types=("fire",)),
            make_pokemon(id=6, name="charizard", types=("fire", "flying")),
            make_pokemon(id=16, name="pidgey", types=("normal", "flying")),
            make_pokemon(id=25, name="pikachu", types=("electric",)),
            make_pokemon(
                id=10034, name="charizard-mega-x", types=("fire", "dragon"), is_default=False
            ),
        ]
    )
    session.flush()


def test_lists_pokemon_in_pokedex_order(db_session: Session) -> None:
    # Added out of order, and alphabetical order would put eevee first.
    db_session.add_all([make_pokemon(id=133, name="eevee"), make_pokemon(id=25, name="pikachu")])
    db_session.flush()

    page = list_pokemon(db_session, PokemonQuery(limit=10))

    assert [pokemon.name for pokemon in page.items] == ["pikachu", "eevee"]


def test_hides_pokemon_pokeapi_no_longer_lists(db_session: Session) -> None:
    db_session.add_all(
        [
            make_pokemon(id=25, name="pikachu"),
            make_pokemon(id=6, name="charizard", removed_at=datetime(2026, 10, 9, tzinfo=UTC)),
        ]
    )
    db_session.flush()

    assert ids(list_pokemon(db_session, PokemonQuery(limit=10))) == [25]


def test_lists_nothing_before_the_first_sync(db_session: Session) -> None:
    assert list_pokemon(db_session, PokemonQuery(limit=10)) == PokemonPage(
        items=[], next_cursor=None
    )


def test_points_to_the_next_page_when_there_is_one(db_session: Session) -> None:
    add_pokemon(db_session, 1, 4, 7)

    page = list_pokemon(db_session, PokemonQuery(limit=2))

    assert (ids(page), page.next_cursor) == ([1, 4], 4)


def test_continues_after_the_cursor(db_session: Session) -> None:
    add_pokemon(db_session, 1, 4, 7)

    page = list_pokemon(db_session, PokemonQuery(limit=2, cursor=4))

    assert (ids(page), page.next_cursor) == ([7], None)


def test_has_no_next_page_when_the_last_page_is_exactly_full(db_session: Session) -> None:
    add_pokemon(db_session, 1, 4)

    assert list_pokemon(db_session, PokemonQuery(limit=2)).next_cursor is None


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


def test_finds_pokemon_by_any_part_of_their_name(db_session: Session) -> None:
    add_pokedex(db_session)

    page = list_pokemon(db_session, PokemonQuery(limit=10, q="Char"))

    assert names(page) == ["charmander", "charizard", "charizard-mega-x"]


def test_matches_spaces_in_a_search_to_hyphens_in_names(db_session: Session) -> None:
    add_pokedex(db_session)

    page = list_pokemon(db_session, PokemonQuery(limit=10, q="mega x"))

    assert names(page) == ["charizard-mega-x"]


def test_treats_wildcard_characters_in_a_search_literally(db_session: Session) -> None:
    add_pokedex(db_session)

    assert list_pokemon(db_session, PokemonQuery(limit=10, q="%")).items == []


def test_filters_by_type(db_session: Session) -> None:
    add_pokedex(db_session)

    page = list_pokemon(db_session, PokemonQuery(limit=10, types=(PokemonType.FLYING,)))

    assert names(page) == ["charizard", "pidgey"]


def test_filters_by_two_types_together(db_session: Session) -> None:
    add_pokedex(db_session)

    query = PokemonQuery(limit=10, types=(PokemonType.FIRE, PokemonType.FLYING))

    assert names(list_pokemon(db_session, query)) == ["charizard"]


def test_can_leave_out_alternate_forms(db_session: Session) -> None:
    add_pokedex(db_session)

    page = list_pokemon(db_session, PokemonQuery(limit=10, q="charizard", forms=False))

    assert names(page) == ["charizard"]


def test_pages_through_filtered_results(db_session: Session) -> None:
    add_pokedex(db_session)

    first = list_pokemon(db_session, PokemonQuery(limit=2, types=(PokemonType.FIRE,)))
    second = list_pokemon(
        db_session, PokemonQuery(limit=2, types=(PokemonType.FIRE,), cursor=first.next_cursor)
    )

    assert (ids(first), first.next_cursor) == ([4, 6], 6)
    assert (ids(second), second.next_cursor) == ([10034], None)
