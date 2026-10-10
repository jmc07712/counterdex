from datetime import UTC, datetime

import pytest
from sqlalchemy.orm import Session

from app.pokemon import models
from app.pokemon.enums import EvolutionTrigger, FormFilter, PokemonType
from app.pokemon.queries import cdn_sprite_url, get_pokemon_details, list_pokemon
from app.pokemon.schemas import (
    EvolutionMethod,
    EvolutionStage,
    PokemonDetails,
    PokemonPage,
    PokemonQuery,
    Species,
)
from tests.support.pokemon import add_pokemon, add_species, make_pokemon

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


def test_lists_every_form_by_default(db_session: Session) -> None:
    add_pokedex(db_session)

    page = list_pokemon(db_session, PokemonQuery(limit=10, q="charizard"))

    assert names(page) == ["charizard", "charizard-mega-x"]


def test_can_list_only_default_forms(db_session: Session) -> None:
    add_pokedex(db_session)

    query = PokemonQuery(limit=10, q="charizard", forms=FormFilter.DEFAULT)

    assert names(list_pokemon(db_session, query)) == ["charizard"]


def test_can_list_only_alternate_forms(db_session: Session) -> None:
    add_pokedex(db_session)

    query = PokemonQuery(limit=10, q="charizard", forms=FormFilter.ALTERNATE)

    assert names(list_pokemon(db_session, query)) == ["charizard-mega-x"]


def test_pages_through_filtered_results(db_session: Session) -> None:
    add_pokedex(db_session)

    first = list_pokemon(db_session, PokemonQuery(limit=2, types=(PokemonType.FIRE,)))
    second = list_pokemon(
        db_session, PokemonQuery(limit=2, types=(PokemonType.FIRE,), cursor=first.next_cursor)
    )

    assert (ids(first), first.next_cursor) == ([4, 6], 6)
    assert (ids(second), second.next_cursor) == ([10034], None)


# --- One Pokémon's details ---

LEVEL_16 = EvolutionMethod(trigger=EvolutionTrigger.LEVEL_UP, min_level=16)
LEVEL_36 = EvolutionMethod(trigger=EvolutionTrigger.LEVEL_UP, min_level=36)
WATER_STONE = EvolutionMethod(trigger=EvolutionTrigger.USE_ITEM, item="water-stone")
THUNDER_STONE = EvolutionMethod(trigger=EvolutionTrigger.USE_ITEM, item="thunder-stone")
REMOVED_AT = datetime(2026, 10, 11, tzinfo=UTC)

# A stage of an evolution family as (species, its Pokémon's id, methods, what it evolves into).
Outline = tuple[str, int | None, list[EvolutionMethod], list["Outline"]]


def outline(stage: EvolutionStage) -> Outline:
    pokemon_id = stage.pokemon.id if stage.pokemon else None
    return (stage.species.name, pokemon_id, stage.methods, [outline(e) for e in stage.evolves_to])


def add_charmander_family(session: Session) -> None:
    add_pokedex(session)
    session.add(make_pokemon(id=5, name="charmeleon", types=("fire",)))
    session.flush()
    add_species(session, 4, family=2, pokemon_ids=[4], name="charmander", genus="Lizard Pokémon")
    add_species(
        session,
        5,
        family=2,
        evolves_from=4,
        methods=[LEVEL_16],
        pokemon_ids=[5],
        name="charmeleon",
        genus="Flame Pokémon",
    )
    add_species(
        session,
        6,
        family=2,
        evolves_from=5,
        methods=[LEVEL_36],
        pokemon_ids=[6, 10034],
        name="charizard",
        genus="Flame Pokémon",
    )


def remove(session: Session, pokemon_id: int) -> None:
    pokemon = session.get(models.Pokemon, pokemon_id)
    assert pokemon is not None
    pokemon.removed_at = REMOVED_AT
    session.flush()


def details(session: Session, pokemon_id: int) -> PokemonDetails:
    found = get_pokemon_details(session, pokemon_id)
    assert found is not None
    return found


def test_gets_a_pokemon_and_its_species(db_session: Session) -> None:
    add_charmander_family(db_session)

    charizard = details(db_session, 6)

    assert (charizard.pokemon.name, charizard.removed_at) == ("charizard", None)
    assert charizard.species == Species(id=6, name="charizard", genus="Flame Pokémon")


def test_gets_every_form_of_its_species(db_session: Session) -> None:
    add_charmander_family(db_session)

    assert [form.name for form in details(db_session, 6).forms] == [
        "charizard",
        "charizard-mega-x",
    ]


def test_leaves_out_forms_pokeapi_no_longer_lists(db_session: Session) -> None:
    add_charmander_family(db_session)
    remove(db_session, 10034)

    assert [form.id for form in details(db_session, 6).forms] == [6]


def test_gets_a_pokemon_pokeapi_no_longer_lists(db_session: Session) -> None:
    add_charmander_family(db_session)
    remove(db_session, 6)

    assert details(db_session, 6).removed_at == REMOVED_AT


def test_gets_the_whole_evolution_family_from_its_first_stage(db_session: Session) -> None:
    add_charmander_family(db_session)

    # From an alternate form too: each stage shows its species' default form.
    evolution = details(db_session, 10034).evolution

    assert evolution is not None
    assert outline(evolution) == (
        "charmander",
        4,
        [],
        [("charmeleon", 5, [LEVEL_16], [("charizard", 6, [LEVEL_36], [])])],
    )


def test_branches_where_a_species_evolves_into_more_than_one(db_session: Session) -> None:
    add_pokemon(db_session, 133, 134, 135)
    add_species(db_session, 133, family=67, pokemon_ids=[133], name="eevee")
    add_species(
        db_session,
        134,
        family=67,
        evolves_from=133,
        methods=[WATER_STONE],
        pokemon_ids=[134],
        name="vaporeon",
    )
    add_species(
        db_session,
        135,
        family=67,
        evolves_from=133,
        methods=[THUNDER_STONE],
        pokemon_ids=[135],
        name="jolteon",
    )

    evolution = details(db_session, 133).evolution

    assert evolution is not None
    assert outline(evolution) == (
        "eevee",
        133,
        [],
        [("vaporeon", 134, [WATER_STONE], []), ("jolteon", 135, [THUNDER_STONE], [])],
    )


def test_shows_a_stage_pokeapi_no_longer_lists_without_its_pokemon(db_session: Session) -> None:
    add_charmander_family(db_session)
    remove(db_session, 5)

    evolution = details(db_session, 6).evolution

    assert evolution is not None
    assert outline(evolution.evolves_to[0])[:2] == ("charmeleon", None)


def test_gets_a_pokemon_whose_species_no_sync_has_stored_yet(db_session: Session) -> None:
    db_session.add(make_pokemon())
    db_session.flush()

    gyarados = details(db_session, 130)

    assert (gyarados.species, gyarados.forms, gyarados.evolution) == (None, [], None)


def test_finds_nothing_for_an_unknown_id(db_session: Session) -> None:
    assert get_pokemon_details(db_session, 999) is None
