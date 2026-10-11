import uuid
from datetime import timedelta

import pytest
from sqlalchemy import func, update
from sqlalchemy.orm import Session

from app.accounts import service as accounts
from app.accounts.types import SignedIn
from app.pokemon.constants import RECENTLY_CHANGED
from app.pokemon.enums import PokemonType
from app.pokemon.models import Pokemon, SpeciesVariety
from app.teams import service
from app.teams.enums import TeamConflictReason
from app.teams.exceptions import (
    MemberNotFoundError,
    NotTeamOwnerError,
    TeamConflictError,
    TeamNotFoundError,
    UnknownPokemonError,
    UserNotFoundError,
)
from app.teams.schemas import NewTeam, TeamOwner, TeamPage, TeamsQuery
from tests.support.accounts import BROCK
from tests.support.teams import (
    add_eevee_family,
    add_mr_mime,
    add_species_pokemon,
    backdate,
    make_team,
    member_ids,
)

TEAM_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")

# --- Creating ---


@pytest.mark.usefixtures("charmander_family")
def test_creates_a_team_with_its_pokemon_in_order(db_session: Session, ash: SignedIn) -> None:
    add_species_pokemon(db_session, 201)

    team, created = service.create_team(
        db_session, ash.user.id, TEAM_ID, NewTeam(name="Fire", pokemon_ids=[10034, 201])
    )

    assert created is True
    assert (team.id, team.name) == (TEAM_ID, "Fire")
    assert [(member.position, member.pokemon.id) for member in team.members] == [
        (0, 10034),
        (1, 201),
    ]
    assert [(member.pokemon.species_id, member.pokemon.family_id) for member in team.members] == [
        (6, 2),
        (201, 1201),
    ]


@pytest.mark.usefixtures("charmander_family")
def test_creating_with_an_id_you_already_have_returns_that_team_unchanged(
    db_session: Session, ash: SignedIn
) -> None:
    first, _ = service.create_team(
        db_session, ash.user.id, TEAM_ID, NewTeam(name="Fire", pokemon_ids=[4])
    )

    again, created = service.create_team(
        db_session, ash.user.id, TEAM_ID, NewTeam(name="Other", pokemon_ids=[5])
    )

    assert created is False
    assert again == first
    assert len(service.list_user_teams(db_session, "ash")) == 1


def test_an_id_another_user_has_is_taken(
    db_session: Session, ash: SignedIn, misty: SignedIn
) -> None:
    service.create_team(db_session, misty.user.id, TEAM_ID, NewTeam(name="Water"))

    with pytest.raises(TeamConflictError) as conflict:
        service.create_team(db_session, ash.user.id, TEAM_ID, NewTeam(name="Fire"))

    assert conflict.value.reason is TeamConflictReason.TEAM_ID_TAKEN


@pytest.mark.usefixtures("charmander_family")
def test_creating_follows_the_family_clause(db_session: Session, ash: SignedIn) -> None:
    with pytest.raises(TeamConflictError) as conflict:
        service.create_team(
            db_session, ash.user.id, TEAM_ID, NewTeam(name="Fire", pokemon_ids=[4, 6])
        )

    assert conflict.value.reason is TeamConflictReason.FAMILY_ON_TEAM


def test_creating_with_an_unknown_pokemon_fails(db_session: Session, ash: SignedIn) -> None:
    with pytest.raises(UnknownPokemonError):
        service.create_team(
            db_session, ash.user.id, TEAM_ID, NewTeam(name="Fire", pokemon_ids=[9999])
        )


@pytest.mark.usefixtures("charmander_family")
def test_creating_with_a_removed_pokemon_fails(db_session: Session, ash: SignedIn) -> None:
    db_session.execute(update(Pokemon).where(Pokemon.id == 4).values(removed_at=func.now()))

    with pytest.raises(TeamConflictError) as conflict:
        service.create_team(db_session, ash.user.id, TEAM_ID, NewTeam(name="Fire", pokemon_ids=[4]))

    assert conflict.value.reason is TeamConflictReason.POKEMON_REMOVED


# --- Reading ---


def test_lists_a_users_teams_most_recently_changed_first(
    db_session: Session, ash: SignedIn, misty: SignedIn
) -> None:
    older = make_team(db_session, ash.user.id, name="Older")
    newer = make_team(db_session, ash.user.id, name="Newer")
    make_team(db_session, misty.user.id, name="Misty's")
    locked = service.lock_owned_team(db_session, ash.user.id, older.id)

    service.rename_team(db_session, locked, "Renamed")

    assert [team.name for team in service.list_user_teams(db_session, "ash")] == [
        "Renamed",
        newer.name,
    ]


def test_finds_a_users_teams_whatever_the_usernames_case(
    db_session: Session, ash: SignedIn
) -> None:
    team = make_team(db_session, ash.user.id)

    assert service.list_user_teams(db_session, "ASH") == [team]


def test_listing_the_teams_of_a_username_no_one_has_fails(db_session: Session) -> None:
    with pytest.raises(UserNotFoundError):
        service.list_user_teams(db_session, "brock")


def test_anyone_can_get_a_team(db_session: Session, misty: SignedIn) -> None:
    team = make_team(db_session, misty.user.id)

    assert service.get_team(db_session, team.id) == team


def test_a_team_no_one_has_isnt_found(db_session: Session) -> None:
    with pytest.raises(TeamNotFoundError):
        service.get_team(db_session, TEAM_ID)


def test_a_team_shows_its_owners_username(db_session: Session, ash: SignedIn) -> None:
    assert make_team(db_session, ash.user.id).owner == TeamOwner(username="ash")


# --- Searching everyone's teams ---


def team_names(page: TeamPage) -> list[str]:
    return [team.name for team in page.items]


def add_teams_to_search(session: Session, ash: SignedIn) -> None:
    """Ash's "Rain Dance" team and Brock's "Sun" team, each with Pokémon 201, and Ash's "Fire"
    team, with Charmander. Needs the charmander_family fixture.
    """
    brock = accounts.sign_up(session, BROCK)
    add_species_pokemon(session, 201)
    make_team(session, ash.user.id, 201, name="Rain Dance")
    make_team(session, brock.user.id, 201, name="Sun")
    make_team(session, ash.user.id, 4, name="Fire")


@pytest.mark.parametrize(
    ("q", "found"),
    [
        pytest.param("dance", ["Rain Dance"], id="team-name"),
        pytest.param("rain dance", ["Rain Dance"], id="team-name-with-a-space"),
        pytest.param("rock", ["Sun"], id="owner-username"),
        pytest.param("charm", ["Fire"], id="pokemon-name"),
    ],
)
@pytest.mark.usefixtures("charmander_family")
def test_a_search_matches_a_teams_name_its_owner_or_a_pokemon_on_it(
    db_session: Session, ash: SignedIn, q: str, found: list[str]
) -> None:
    add_teams_to_search(db_session, ash)

    page = service.list_teams(db_session, TeamsQuery(q=q))

    assert (team_names(page), page.next_cursor) == (found, None)


@pytest.mark.parametrize(
    ("q", "found"),
    [
        pytest.param("mr mime", ["Psychic"], id="mr-mime"),
        pytest.param("mega x", ["Zard"], id="charizard-mega-x"),
    ],
)
@pytest.mark.usefixtures("charmander_family")
def test_a_search_with_spaces_matches_a_pokemons_hyphenated_name(
    db_session: Session, ash: SignedIn, q: str, found: list[str]
) -> None:
    add_mr_mime(db_session)
    make_team(db_session, ash.user.id, 122, name="Psychic")
    make_team(db_session, ash.user.id, 10034, name="Zard")
    make_team(db_session, ash.user.id, 4, name="Fire")

    assert team_names(service.list_teams(db_session, TeamsQuery(q=q))) == found


@pytest.mark.parametrize(
    ("q", "found"),
    [
        pytest.param("DANCE", ["Rain Dance"], id="team-name"),
        pytest.param("BROCK", ["Sun"], id="owner-username"),
    ],
)
@pytest.mark.usefixtures("charmander_family")
def test_a_search_ignores_case(
    db_session: Session, ash: SignedIn, q: str, found: list[str]
) -> None:
    add_teams_to_search(db_session, ash)

    assert team_names(service.list_teams(db_session, TeamsQuery(q=q))) == found


@pytest.mark.parametrize(
    ("q", "found"),
    [
        pytest.param("%", ["100% sure"], id="percent"),
        pytest.param("_", ["fire_team"], id="underscore"),
    ],
)
def test_wildcards_in_a_search_match_themselves(
    db_session: Session, ash: SignedIn, q: str, found: list[str]
) -> None:
    add_species_pokemon(db_session, 201)
    for name in ["100% sure", "fire_team", "plain"]:
        make_team(db_session, ash.user.id, 201, name=name)

    assert team_names(service.list_teams(db_session, TeamsQuery(q=q))) == found


@pytest.mark.usefixtures("charmander_family")
def test_a_team_with_two_matching_pokemon_is_found_once(db_session: Session, ash: SignedIn) -> None:
    add_species_pokemon(db_session, 201, 202)
    make_team(db_session, ash.user.id, 201, 202, name="Pair")
    make_team(db_session, ash.user.id, 4, name="Other")

    page = service.list_teams(db_session, TeamsQuery(q="pokemon-20"))

    assert (team_names(page), page.next_cursor) == (["Pair"], None)


@pytest.mark.usefixtures("charmander_family")
def test_a_search_nothing_matches_gives_an_empty_page(db_session: Session, ash: SignedIn) -> None:
    add_teams_to_search(db_session, ash)

    page = service.list_teams(db_session, TeamsQuery(q="squirtle"))

    assert page == TeamPage(items=[], next_cursor=None)


@pytest.mark.parametrize(
    ("q", "found"),
    [
        pytest.param("rain", ["Rain full"], id="name-matches"),
        pytest.param("ash", [], id="owner-matches"),
    ],
)
def test_a_search_never_finds_a_team_with_no_pokemon(
    db_session: Session, ash: SignedIn, misty: SignedIn, q: str, found: list[str]
) -> None:
    add_species_pokemon(db_session, 201)
    make_team(db_session, ash.user.id, name="Rain empty")
    make_team(db_session, misty.user.id, 201, name="Rain full")
    make_team(db_session, misty.user.id, 201, name="Sun")

    assert team_names(service.list_teams(db_session, TeamsQuery(q=q))) == found


def test_pages_through_a_search_without_repeating_or_skipping_a_team(
    db_session: Session, ash: SignedIn
) -> None:
    add_species_pokemon(db_session, 201)
    # Fire teams at 1, 3, 5, 7 and 9 hours old, with other teams between them.
    for hours in range(1, 10):
        name = f"Fire {hours}h" if hours % 2 else f"Water {hours}h"
        team = make_team(db_session, ash.user.id, 201, name=name)
        backdate(db_session, team.id, timedelta(hours=hours))

    first = service.list_teams(db_session, TeamsQuery(q="fire", limit=2))
    second = service.list_teams(db_session, TeamsQuery(q="fire", limit=2, cursor=first.next_cursor))
    third = service.list_teams(db_session, TeamsQuery(q="fire", limit=2, cursor=second.next_cursor))

    assert [team_names(page) for page in (first, second, third)] == [
        ["Fire 1h", "Fire 3h"],
        ["Fire 5h", "Fire 7h"],
        ["Fire 9h"],
    ]
    assert (first.next_cursor, second.next_cursor, third.next_cursor) == (
        first.items[-1].id,
        second.items[-1].id,
        None,
    )


def test_a_search_with_a_cursor_no_team_has_gives_an_empty_page(
    db_session: Session, ash: SignedIn
) -> None:
    add_species_pokemon(db_session, 201)
    make_team(db_session, ash.user.id, 201, name="Rain")

    page = service.list_teams(db_session, TeamsQuery(q="rain", cursor=TEAM_ID))

    assert page == TeamPage(items=[], next_cursor=None)


# --- Filtering everyone's teams ---


def add_teams_to_filter(session: Session, ash: SignedIn) -> None:
    """Ash's teams, newest first: "Fire and water" (Charmander, Fire, and Pokémon 201, Water and
    Flying), "Fire" (Charmander) and "Water" (201). Needs the charmander_family fixture.
    """
    add_species_pokemon(session, 201)
    make_team(session, ash.user.id, 4, 201, name="Fire and water")
    fire = make_team(session, ash.user.id, 4, name="Fire")
    water = make_team(session, ash.user.id, 201, name="Water")
    backdate(session, fire.id, timedelta(hours=1))
    backdate(session, water.id, timedelta(hours=2))


def change_recently(session: Session, pokemon_id: int, age: timedelta = timedelta(0)) -> None:
    """Makes it look as if a sync changed the Pokémon `age` ago."""
    session.execute(
        update(Pokemon).where(Pokemon.id == pokemon_id).values(last_changed_at=func.now() - age)
    )


@pytest.mark.parametrize(
    ("types", "found"),
    [
        pytest.param((PokemonType.FIRE,), ["Fire and water", "Fire"], id="one-type"),
        pytest.param(
            (PokemonType.FIRE, PokemonType.WATER), ["Fire and water"], id="types-on-two-members"
        ),
        pytest.param(
            (PokemonType.WATER, PokemonType.FLYING),
            ["Fire and water", "Water"],
            id="types-on-one-member",
        ),
        pytest.param((PokemonType.DRAGON,), [], id="a-type-no-member-has"),
    ],
)
@pytest.mark.usefixtures("charmander_family")
def test_types_find_teams_with_a_pokemon_of_each(
    db_session: Session, ash: SignedIn, types: tuple[PokemonType, ...], found: list[str]
) -> None:
    add_teams_to_filter(db_session, ash)

    page = service.list_teams(db_session, TeamsQuery(types=types))

    assert (team_names(page), page.next_cursor) == (found, None)


@pytest.mark.parametrize(
    ("age", "found"),
    [
        pytest.param(RECENTLY_CHANGED, ["Fire and water", "Water"], id="a-week-ago"),
        pytest.param(RECENTLY_CHANGED + timedelta(microseconds=1), [], id="just-over-a-week-ago"),
    ],
)
@pytest.mark.usefixtures("charmander_family")
def test_changed_finds_teams_with_a_pokemon_a_sync_changed_in_the_last_week(
    db_session: Session, ash: SignedIn, age: timedelta, found: list[str]
) -> None:
    add_teams_to_filter(db_session, ash)
    # Pokémon 201 is on "Fire and water" and "Water"; Charmander has never changed.
    change_recently(db_session, 201, age)

    page = service.list_teams(db_session, TeamsQuery(changed=True))

    assert team_names(page) == found


@pytest.mark.parametrize(
    "query",
    [
        pytest.param(TeamsQuery(q="fire", types=(PokemonType.WATER,)), id="search-and-type"),
        pytest.param(TeamsQuery(q="fire", changed=True), id="search-and-changed"),
        pytest.param(TeamsQuery(types=(PokemonType.FIRE,), changed=True), id="type-and-changed"),
    ],
)
@pytest.mark.usefixtures("charmander_family")
def test_filters_combine_with_each_other_and_a_search(
    db_session: Session, ash: SignedIn, query: TeamsQuery
) -> None:
    add_teams_to_filter(db_session, ash)
    change_recently(db_session, 201)

    assert team_names(service.list_teams(db_session, query)) == ["Fire and water"]


@pytest.mark.usefixtures("charmander_family")
def test_pages_through_filtered_teams_without_repeating_or_skipping_one(
    db_session: Session, ash: SignedIn
) -> None:
    add_species_pokemon(db_session, 201)
    # Teams with Charmander, a Fire type, at 1, 3, 5, 7 and 9 hours old, and teams of Pokémon
    # 201, Water and Flying, between them.
    for hours in range(1, 10):
        pokemon_id = 4 if hours % 2 else 201
        team = make_team(db_session, ash.user.id, pokemon_id, name=f"{hours}h")
        backdate(db_session, team.id, timedelta(hours=hours))
    fire = (PokemonType.FIRE,)

    first = service.list_teams(db_session, TeamsQuery(types=fire, limit=2))
    second = service.list_teams(
        db_session, TeamsQuery(types=fire, limit=2, cursor=first.next_cursor)
    )
    third = service.list_teams(
        db_session, TeamsQuery(types=fire, limit=2, cursor=second.next_cursor)
    )

    assert [team_names(page) for page in (first, second, third)] == [
        ["1h", "3h"],
        ["5h", "7h"],
        ["9h"],
    ]
    assert third.next_cursor is None


# --- Listing one owner's teams ---


def add_teams_of_two_owners(session: Session, ash: SignedIn, misty: SignedIn) -> None:
    """Ash's teams as add_teams_to_filter makes them, then his "Fire plans", a team with no
    Pokémon that is 3 hours old, and Misty's "Misty's fire" (Charmander and Pokémon 201) that is
    30 minutes old. Needs the charmander_family fixture.
    """
    add_teams_to_filter(session, ash)
    plans = make_team(session, ash.user.id, name="Fire plans")
    mistys = make_team(session, misty.user.id, 4, 201, name="Misty's fire")
    backdate(session, plans.id, timedelta(hours=3))
    backdate(session, mistys.id, timedelta(minutes=30))


@pytest.mark.usefixtures("charmander_family")
def test_an_owner_finds_their_teams_including_ones_with_no_pokemon(
    db_session: Session, ash: SignedIn, misty: SignedIn
) -> None:
    add_teams_of_two_owners(db_session, ash, misty)

    page = service.list_teams(db_session, TeamsQuery(owner="ash"))

    assert (team_names(page), page.next_cursor) == (
        ["Fire and water", "Fire", "Water", "Fire plans"],
        None,
    )


def test_an_owner_is_found_whatever_the_usernames_case(db_session: Session) -> None:
    brock = accounts.sign_up(db_session, BROCK)
    make_team(db_session, brock.user.id, name="Rocks")

    assert team_names(service.list_teams(db_session, TeamsQuery(owner="bROCK"))) == ["Rocks"]


@pytest.mark.parametrize(
    ("query", "found"),
    [
        pytest.param(
            TeamsQuery(owner="ash", q="fire"),
            ["Fire and water", "Fire", "Fire plans"],
            id="search",
        ),
        pytest.param(
            TeamsQuery(owner="ash", types=(PokemonType.WATER,)),
            ["Fire and water", "Water"],
            id="type",
        ),
        pytest.param(
            TeamsQuery(owner="ash", types=(PokemonType.FIRE, PokemonType.WATER)),
            ["Fire and water"],
            id="types-on-two-members",
        ),
        pytest.param(
            TeamsQuery(owner="ash", changed=True), ["Fire and water", "Water"], id="changed"
        ),
    ],
)
@pytest.mark.usefixtures("charmander_family")
def test_an_owner_combines_with_the_other_filters(
    db_session: Session, ash: SignedIn, misty: SignedIn, query: TeamsQuery, found: list[str]
) -> None:
    add_teams_of_two_owners(db_session, ash, misty)
    # Pokémon 201 is on a team of Misty's too, which none of these finds.
    change_recently(db_session, 201)

    assert team_names(service.list_teams(db_session, query)) == found


def test_pages_through_an_owners_teams_without_repeating_or_skipping_one(
    db_session: Session, ash: SignedIn, misty: SignedIn
) -> None:
    add_species_pokemon(db_session, 201)
    # Ash's teams at 1 to 5 hours old, every other one with no Pokémon, and Misty's teams
    # between them.
    for hours in range(1, 6):
        pokemon_ids = [201] if hours % 2 else []
        ashs = make_team(db_session, ash.user.id, *pokemon_ids, name=f"{hours}h")
        mistys = make_team(db_session, misty.user.id, 201, name=f"Misty's {hours}h")
        backdate(db_session, ashs.id, timedelta(hours=hours))
        backdate(db_session, mistys.id, timedelta(hours=hours, minutes=30))

    first = service.list_teams(db_session, TeamsQuery(owner="ash", limit=2))
    second = service.list_teams(
        db_session, TeamsQuery(owner="ash", limit=2, cursor=first.next_cursor)
    )
    third = service.list_teams(
        db_session, TeamsQuery(owner="ash", limit=2, cursor=second.next_cursor)
    )

    assert [team_names(page) for page in (first, second, third)] == [
        ["1h", "2h"],
        ["3h", "4h"],
        ["5h"],
    ]
    assert (first.next_cursor, second.next_cursor, third.next_cursor) == (
        first.items[-1].id,
        second.items[-1].id,
        None,
    )


def test_an_owner_no_one_has_gives_an_empty_page(db_session: Session, ash: SignedIn) -> None:
    make_team(db_session, ash.user.id, name="Empty")

    page = service.list_teams(db_session, TeamsQuery(owner="brock"))

    assert page == TeamPage(items=[], next_cursor=None)


def test_without_an_owner_teams_with_no_pokemon_are_left_out(
    db_session: Session, ash: SignedIn, misty: SignedIn
) -> None:
    add_species_pokemon(db_session, 201)
    make_team(db_session, ash.user.id, name="Empty")
    make_team(db_session, misty.user.id, 201, name="Full")

    assert team_names(service.list_teams(db_session, TeamsQuery())) == ["Full"]


# --- Locking a team to change it ---


def test_a_team_no_one_has_cant_be_locked(db_session: Session, ash: SignedIn) -> None:
    with pytest.raises(TeamNotFoundError):
        service.lock_owned_team(db_session, ash.user.id, TEAM_ID)


def test_only_a_teams_owner_can_lock_it(
    db_session: Session, ash: SignedIn, misty: SignedIn
) -> None:
    team = make_team(db_session, misty.user.id)

    with pytest.raises(NotTeamOwnerError):
        service.lock_owned_team(db_session, ash.user.id, team.id)


# --- Renaming and deleting ---


def test_renaming_changes_the_name_and_when_it_changed(db_session: Session, ash: SignedIn) -> None:
    team = make_team(db_session, ash.user.id)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    renamed = service.rename_team(db_session, locked, "Rain")

    assert renamed.name == "Rain"
    assert renamed.updated_at > team.updated_at


@pytest.mark.usefixtures("charmander_family")
def test_deleting_removes_the_team(db_session: Session, ash: SignedIn) -> None:
    team = make_team(db_session, ash.user.id, 4)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    service.delete_team(db_session, locked)

    assert service.list_user_teams(db_session, "ash") == []


def test_member_ids_lists_slot_order(db_session: Session, ash: SignedIn) -> None:
    add_species_pokemon(db_session, 201, 202, 203)

    assert member_ids(make_team(db_session, ash.user.id, 203, 201, 202)) == [203, 201, 202]


def test_creates_a_full_team(db_session: Session, ash: SignedIn) -> None:
    add_species_pokemon(db_session, 201, 202, 203, 204, 205, 206)

    team = make_team(db_session, ash.user.id, 201, 202, 203, 204, 205, 206)

    assert member_ids(team) == [201, 202, 203, 204, 205, 206]


# --- Adding ---


@pytest.mark.usefixtures("charmander_family")
def test_adding_fills_the_next_slot(db_session: Session, ash: SignedIn) -> None:
    add_species_pokemon(db_session, 201)
    team = make_team(db_session, ash.user.id, 6)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    added = service.add_member(db_session, locked, 201)

    assert member_ids(added) == [6, 201]
    assert added.updated_at > team.updated_at


@pytest.mark.parametrize(
    "pokemon_id",
    [
        pytest.param(4, id="earlier-stage"),
        pytest.param(5, id="middle-stage"),
        pytest.param(10034, id="other-form"),
    ],
)
@pytest.mark.usefixtures("charmander_family")
def test_adding_a_pokemon_whose_family_is_on_the_team_fails(
    db_session: Session, ash: SignedIn, pokemon_id: int
) -> None:
    team = make_team(db_session, ash.user.id, 6)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    with pytest.raises(TeamConflictError) as conflict:
        service.add_member(db_session, locked, pokemon_id)

    assert conflict.value.reason is TeamConflictReason.FAMILY_ON_TEAM


def test_branches_of_one_family_cant_share_a_team(db_session: Session, ash: SignedIn) -> None:
    # Vaporeon and Jolteon both evolve from Eevee.
    add_eevee_family(db_session)
    team = make_team(db_session, ash.user.id, 134)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    with pytest.raises(TeamConflictError) as conflict:
        service.add_member(db_session, locked, 135)

    assert conflict.value.reason is TeamConflictReason.FAMILY_ON_TEAM


def test_adding_to_a_full_team_fails(db_session: Session, ash: SignedIn) -> None:
    add_species_pokemon(db_session, 201, 202, 203, 204, 205, 206, 207)
    team = make_team(db_session, ash.user.id, 201, 202, 203, 204, 205, 206)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    with pytest.raises(TeamConflictError) as conflict:
        service.add_member(db_session, locked, 207)

    assert conflict.value.reason is TeamConflictReason.TEAM_FULL


# --- Replacing ---


@pytest.mark.usefixtures("charmander_family")
def test_replacing_keeps_the_slot(db_session: Session, ash: SignedIn) -> None:
    add_species_pokemon(db_session, 201)
    team = make_team(db_session, ash.user.id, 4, 201)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    replaced = service.replace_member(db_session, locked, 4, 6)

    assert member_ids(replaced) == [6, 201]


@pytest.mark.usefixtures("charmander_family")
def test_replacing_with_a_member_moves_it_into_the_slot(db_session: Session, ash: SignedIn) -> None:
    add_species_pokemon(db_session, 201, 202)
    team = make_team(db_session, ash.user.id, 4, 201, 202)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    replaced = service.replace_member(db_session, locked, 4, 202)

    assert member_ids(replaced) == [202, 201]
    assert [member.position for member in replaced.members] == [0, 1]


@pytest.mark.usefixtures("charmander_family")
def test_a_full_team_can_replace(db_session: Session, ash: SignedIn) -> None:
    add_species_pokemon(db_session, 201, 202, 203, 204, 205)
    team = make_team(db_session, ash.user.id, 4, 201, 202, 203, 204, 205)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    replaced = service.replace_member(db_session, locked, 4, 6)

    assert member_ids(replaced) == [6, 201, 202, 203, 204, 205]


@pytest.mark.usefixtures("charmander_family")
def test_a_member_can_be_replaced_by_a_later_stage(db_session: Session, ash: SignedIn) -> None:
    team = make_team(db_session, ash.user.id, 4)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    assert member_ids(service.replace_member(db_session, locked, 4, 6)) == [6]


@pytest.mark.usefixtures("charmander_family")
def test_a_member_can_be_replaced_by_its_other_form(db_session: Session, ash: SignedIn) -> None:
    team = make_team(db_session, ash.user.id, 6)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    assert member_ids(service.replace_member(db_session, locked, 6, 10034)) == [10034]


def test_a_member_can_be_replaced_by_another_branch_of_its_family(
    db_session: Session, ash: SignedIn
) -> None:
    add_eevee_family(db_session)
    team = make_team(db_session, ash.user.id, 134)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    replaced = service.replace_member(db_session, locked, 134, 135)

    assert [(member.pokemon.id, member.pokemon.family_id) for member in replaced.members] == [
        (135, 67)
    ]


@pytest.mark.usefixtures("charmander_family")
def test_replacing_cant_break_the_family_clause(db_session: Session, ash: SignedIn) -> None:
    add_species_pokemon(db_session, 201)
    team = make_team(db_session, ash.user.id, 4, 201)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    with pytest.raises(TeamConflictError) as conflict:
        service.replace_member(db_session, locked, 201, 6)

    assert conflict.value.reason is TeamConflictReason.FAMILY_ON_TEAM


@pytest.mark.usefixtures("charmander_family")
def test_replacing_a_pokemon_not_on_the_team_fails(db_session: Session, ash: SignedIn) -> None:
    team = make_team(db_session, ash.user.id, 4)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    with pytest.raises(MemberNotFoundError):
        service.replace_member(db_session, locked, 5, 6)


# --- Removing ---


def test_removing_closes_the_gap(db_session: Session, ash: SignedIn) -> None:
    add_species_pokemon(db_session, 201, 202, 203)
    team = make_team(db_session, ash.user.id, 201, 202, 203)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    removed = service.remove_member(db_session, locked, 201)

    assert [(member.position, member.pokemon.id) for member in removed.members] == [
        (0, 202),
        (1, 203),
    ]


def test_removing_a_pokemon_not_on_the_team_fails(db_session: Session, ash: SignedIn) -> None:
    team = make_team(db_session, ash.user.id)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    with pytest.raises(MemberNotFoundError):
        service.remove_member(db_session, locked, 201)


# --- Reordering ---


def test_reorders(db_session: Session, ash: SignedIn) -> None:
    add_species_pokemon(db_session, 201, 202, 203)
    team = make_team(db_session, ash.user.id, 201, 202, 203)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    reordered = service.reorder(db_session, locked, [203, 201, 202])

    assert member_ids(reordered) == [203, 201, 202]


@pytest.mark.parametrize("order", [[202, 201], [203, 201, 202, 204]])
def test_an_order_that_isnt_the_members_is_out_of_date(
    db_session: Session, ash: SignedIn, order: list[int]
) -> None:
    add_species_pokemon(db_session, 201, 202, 203, 204)
    team = make_team(db_session, ash.user.id, 201, 202, 203)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    with pytest.raises(TeamConflictError) as conflict:
        service.reorder(db_session, locked, order)

    assert conflict.value.reason is TeamConflictReason.ORDER_OUT_OF_DATE


# --- Following a sync ---


def test_members_follow_their_pokemon_to_another_species_family(
    db_session: Session, ash: SignedIn
) -> None:
    add_species_pokemon(db_session, 201, 202, 203)
    team = make_team(db_session, ash.user.id, 201, 203)
    # As a sync does when PokéAPI moves a Pokémon to a species in another family.
    db_session.execute(
        update(SpeciesVariety).where(SpeciesVariety.pokemon_id == 201).values(species_id=202)
    )

    service.follow_species_families(db_session)

    assert [
        (member.pokemon.id, member.pokemon.species_id, member.pokemon.family_id)
        for member in service.get_team(db_session, team.id).members
    ] == [(201, 202, 1202), (203, 203, 1203)]


# --- Previewing ---


@pytest.mark.usefixtures("charmander_family")
def test_previews_pokemon_as_members_in_the_order_given(db_session: Session) -> None:
    add_species_pokemon(db_session, 201)

    members = service.preview(db_session, [6, 9999, 201])

    assert [(member.position, member.pokemon.id) for member in members] == [(0, 6), (1, 201)]
    assert [member.pokemon.family_id for member in members] == [2, 1201]
