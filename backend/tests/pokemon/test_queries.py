from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from app.pokemon import models
from app.pokemon.enums import EvolutionTrigger, FormFilter, ListingStatus, PokemonType
from app.pokemon.queries import cdn_sprite_url, get_pokemon_details, list_pokemon
from app.pokemon.schemas import (
    EvolutionMethod,
    EvolutionStage,
    PokemonDetails,
    PokemonPage,
    PokemonQuery,
    Species,
)
from tests.support.pokemon import (
    GYARADOS_CDN_SPRITE,
    GYARADOS_SPRITE,
    LEVEL_16,
    LEVEL_36,
    add_pokemon,
    add_species,
    make_pokemon,
)


def ids(page: PokemonPage) -> list[int]:
    return [pokemon.id for pokemon in page.items]


def names(page: PokemonPage) -> list[str]:
    return [pokemon.name for pokemon in page.items]


@pytest.fixture
def pokedex(db_session: Session) -> None:
    """A few Pokémon with differing names, types and forms."""
    db_session.add_all(
        [
            make_pokemon(id=4, name="charmander", types=["fire"]),
            make_pokemon(id=6, name="charizard", types=["fire", "flying"]),
            make_pokemon(id=16, name="pidgey", types=["normal", "flying"]),
            make_pokemon(id=25, name="pikachu", types=["electric"]),
            make_pokemon(
                id=10034, name="charizard-mega-x", types=["fire", "dragon"], is_default=False
            ),
        ]
    )
    db_session.flush()


def test_lists_pokemon_in_pokedex_order(db_session: Session) -> None:
    # Added out of order, and alphabetical order would put eevee first.
    db_session.add_all([make_pokemon(id=133, name="eevee"), make_pokemon(id=25, name="pikachu")])
    db_session.flush()

    page = list_pokemon(db_session, PokemonQuery())

    assert names(page) == ["pikachu", "eevee"]


@pytest.mark.parametrize(
    ("query", "expected_ids"),
    [
        pytest.param(PokemonQuery(), [25], id="listed-by-default"),
        pytest.param(PokemonQuery(status=ListingStatus.REMOVED), [6], id="removed"),
    ],
)
def test_lists_pokemon_by_whether_pokeapi_still_lists_them(
    db_session: Session, query: PokemonQuery, expected_ids: list[int]
) -> None:
    db_session.add_all(
        [
            make_pokemon(id=25, name="pikachu"),
            make_pokemon(id=6, name="charizard", removed_at=datetime(2026, 10, 9, tzinfo=UTC)),
        ]
    )
    db_session.flush()

    assert ids(list_pokemon(db_session, query)) == expected_ids


def test_lists_only_pokemon_a_sync_changed_in_the_last_week(db_session: Session) -> None:
    now = datetime.now(UTC)
    db_session.add_all(
        [
            make_pokemon(id=1, name="bulbasaur", last_changed_at=now - timedelta(days=2)),
            make_pokemon(id=2, name="ivysaur", last_changed_at=now - timedelta(days=8)),
            make_pokemon(id=3, name="venusaur"),
        ]
    )
    db_session.flush()

    assert ids(list_pokemon(db_session, PokemonQuery(changed=True))) == [1]


def test_says_which_pokemon_a_sync_changed_in_the_last_week(db_session: Session) -> None:
    now = datetime.now(UTC)
    db_session.add_all(
        [
            make_pokemon(id=1, name="bulbasaur", last_changed_at=now - timedelta(days=2)),
            make_pokemon(id=2, name="ivysaur", last_changed_at=now - timedelta(days=8)),
            make_pokemon(id=3, name="venusaur"),
        ]
    )
    db_session.flush()

    page = list_pokemon(db_session, PokemonQuery())

    assert [pokemon.changed_recently for pokemon in page.items] == [True, False, False]


def test_lists_nothing_before_the_first_sync(db_session: Session) -> None:
    assert list_pokemon(db_session, PokemonQuery()) == PokemonPage(items=[], next_cursor=None)


@pytest.mark.parametrize(
    ("limit", "cursor", "page_ids", "next_cursor"),
    [
        pytest.param(2, None, [1, 4], 4, id="points-to-the-next-page"),
        pytest.param(2, 4, [7], None, id="continues-after-the-cursor"),
        pytest.param(3, None, [1, 4, 7], None, id="exactly-full-last-page"),
    ],
)
def test_pages_through_pokemon_by_pokedex_number(
    db_session: Session,
    limit: int,
    cursor: int | None,
    page_ids: list[int],
    next_cursor: int | None,
) -> None:
    add_pokemon(db_session, 1, 4, 7)

    page = list_pokemon(db_session, PokemonQuery(limit=limit, cursor=cursor))

    assert (ids(page), page.next_cursor) == (page_ids, next_cursor)


@pytest.mark.parametrize(
    ("stored", "served"),
    [
        (GYARADOS_SPRITE, GYARADOS_CDN_SPRITE),
        ("https://example.com/sprite.png", "https://example.com/sprite.png"),
        (None, None),
    ],
)
def test_only_sprites_hosted_on_github_are_moved_to_the_cdn(
    stored: str | None, served: str | None
) -> None:
    assert cdn_sprite_url(stored) == served


@pytest.mark.parametrize(
    ("query", "listed"),
    [
        pytest.param(
            PokemonQuery(q="Char"),
            ["charmander", "charizard", "charizard-mega-x"],
            id="any-part-of-the-name",
        ),
        pytest.param(PokemonQuery(q="%"), [], id="wildcards-in-a-search-match-literally"),
        pytest.param(
            PokemonQuery(types=(PokemonType.FLYING,)), ["charizard", "pidgey"], id="one-type"
        ),
        pytest.param(
            PokemonQuery(types=(PokemonType.FIRE, PokemonType.FLYING)),
            ["charizard"],
            id="both-types",
        ),
        pytest.param(
            PokemonQuery(q="charizard"),
            ["charizard", "charizard-mega-x"],
            id="every-form-by-default",
        ),
        pytest.param(
            PokemonQuery(q="charizard", forms=FormFilter.DEFAULT),
            ["charizard"],
            id="only-default-forms",
        ),
        pytest.param(
            PokemonQuery(q="charizard", forms=FormFilter.ALTERNATE),
            ["charizard-mega-x"],
            id="only-alternate-forms",
        ),
    ],
)
@pytest.mark.usefixtures("pokedex")
def test_lists_only_the_pokemon_matching_every_filter(
    db_session: Session, query: PokemonQuery, listed: list[str]
) -> None:
    assert names(list_pokemon(db_session, query)) == listed


@pytest.mark.usefixtures("pokedex")
def test_pages_through_filtered_results(db_session: Session) -> None:
    first = list_pokemon(db_session, PokemonQuery(limit=2, types=(PokemonType.FIRE,)))
    second = list_pokemon(
        db_session, PokemonQuery(limit=2, types=(PokemonType.FIRE,), cursor=first.next_cursor)
    )

    assert (ids(first), first.next_cursor) == ([4, 6], 6)
    assert (ids(second), second.next_cursor) == ([10034], None)


# --- One Pokémon's details ---

REMOVED_AT = datetime(2026, 10, 11, tzinfo=UTC)

# A stage of an evolution family as (species, its Pokémon's id, methods, what it evolves into).
Outline = tuple[str, int | None, list[EvolutionMethod], list["Outline"]]


def outline(stage: EvolutionStage) -> Outline:
    pokemon_id = stage.pokemon.id if stage.pokemon else None
    return (stage.species.name, pokemon_id, stage.methods, [outline(e) for e in stage.evolves_to])


def remove(session: Session, pokemon_id: int) -> None:
    pokemon = session.get(models.Pokemon, pokemon_id)
    assert pokemon is not None
    pokemon.removed_at = REMOVED_AT
    session.flush()


def details(session: Session, pokemon_id: int) -> PokemonDetails:
    found = get_pokemon_details(session, pokemon_id)
    assert found is not None
    return found


@pytest.mark.usefixtures("charmander_family")
def test_gets_a_pokemon_and_its_species(db_session: Session) -> None:
    charizard = details(db_session, 6)

    assert (charizard.pokemon.name, charizard.removed_at) == ("charizard", None)
    assert charizard.species == Species(id=6, name="charizard", genus="Flame Pokémon")


@pytest.mark.usefixtures("charmander_family")
def test_gets_every_form_of_its_species(db_session: Session) -> None:
    assert [form.name for form in details(db_session, 6).forms] == [
        "charizard",
        "charizard-mega-x",
    ]


@pytest.mark.usefixtures("charmander_family")
def test_leaves_out_forms_pokeapi_no_longer_lists(db_session: Session) -> None:
    remove(db_session, 10034)

    assert [form.id for form in details(db_session, 6).forms] == [6]


@pytest.mark.usefixtures("charmander_family")
def test_gets_a_pokemon_pokeapi_no_longer_lists(db_session: Session) -> None:
    remove(db_session, 6)

    assert details(db_session, 6).removed_at == REMOVED_AT


@pytest.mark.usefixtures("charmander_family")
def test_gets_the_whole_evolution_family_from_its_first_stage(db_session: Session) -> None:
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
    water_stone = EvolutionMethod(trigger=EvolutionTrigger.USE_ITEM, item="water-stone")
    thunder_stone = EvolutionMethod(trigger=EvolutionTrigger.USE_ITEM, item="thunder-stone")
    add_pokemon(db_session, 133, 134, 135)
    add_species(db_session, 133, family=67, pokemon_ids=[133], name="eevee")
    add_species(
        db_session,
        134,
        family=67,
        evolves_from=133,
        methods=[water_stone],
        pokemon_ids=[134],
        name="vaporeon",
    )
    add_species(
        db_session,
        135,
        family=67,
        evolves_from=133,
        methods=[thunder_stone],
        pokemon_ids=[135],
        name="jolteon",
    )

    evolution = details(db_session, 133).evolution

    assert evolution is not None
    assert outline(evolution) == (
        "eevee",
        133,
        [],
        [("vaporeon", 134, [water_stone], []), ("jolteon", 135, [thunder_stone], [])],
    )


@pytest.mark.usefixtures("charmander_family")
def test_shows_a_stage_pokeapi_no_longer_lists_without_its_pokemon(db_session: Session) -> None:
    remove(db_session, 5)

    evolution = details(db_session, 6).evolution

    assert evolution is not None
    assert outline(evolution.evolves_to[0])[:2] == ("charmeleon", None)


def test_lists_each_pokemons_species(
    db_session: Session, charmander_family: None, gyarados: models.Pokemon
) -> None:
    page = list_pokemon(db_session, PokemonQuery())

    # Gyarados has no stored species; Mega Charizard X is a Charizard.
    assert {each.id: each.species_id for each in page.items} == {
        4: 4,
        5: 5,
        6: 6,
        130: None,
        10034: 6,
    }


def test_details_give_the_pokemons_species(db_session: Session, charmander_family: None) -> None:
    charizard = details(db_session, 10034)

    assert charizard.pokemon.species_id == 6
    assert {form.id: form.species_id for form in charizard.forms} == {6: 6, 10034: 6}


@pytest.mark.usefixtures("gyarados")
def test_gets_a_pokemon_whose_species_no_sync_has_stored_yet(db_session: Session) -> None:
    gyarados = details(db_session, 130)

    assert (gyarados.species, gyarados.forms, gyarados.evolution) == (None, [], None)
