import uuid

import pytest
from sqlalchemy import func, update
from sqlalchemy.orm import Session

from app.accounts.types import SignedIn
from app.pokemon.models import Pokemon, SpeciesVariety
from app.teams import queries, service
from app.teams.enums import TeamConflictReason
from app.teams.exceptions import (
    MemberNotFoundError,
    TeamConflictError,
)
from app.teams.schemas import NewTeam
from tests.support.teams import (
    add_eevee_family,
    add_species_pokemon,
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
    assert len(queries.list_user_teams(db_session, "ash")) == 1


@pytest.mark.usefixtures("charmander_family")
def test_creating_with_a_removed_pokemon_fails(db_session: Session, ash: SignedIn) -> None:
    db_session.execute(update(Pokemon).where(Pokemon.id == 4).values(removed_at=func.now()))

    with pytest.raises(TeamConflictError) as conflict:
        service.create_team(db_session, ash.user.id, TEAM_ID, NewTeam(name="Fire", pokemon_ids=[4]))

    assert conflict.value.reason is TeamConflictReason.POKEMON_REMOVED


# --- Renaming ---


def test_renaming_changes_the_name_and_when_it_changed(db_session: Session, ash: SignedIn) -> None:
    team = make_team(db_session, ash.user.id)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    renamed = service.rename_team(db_session, locked, "Rain")

    assert renamed.name == "Rain"
    assert renamed.updated_at > team.updated_at


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


# A member's own family can replace it: a later stage, another form or another branch.
@pytest.mark.parametrize(
    ("old", "new", "family"),
    [
        pytest.param(4, 6, 2, id="later-stage"),
        pytest.param(6, 10034, 2, id="other-form"),
        pytest.param(134, 135, 67, id="another-branch"),
    ],
)
@pytest.mark.usefixtures("charmander_family")
def test_replacing_keeps_the_slot(
    db_session: Session, ash: SignedIn, old: int, new: int, family: int
) -> None:
    add_eevee_family(db_session)
    add_species_pokemon(db_session, 201)
    team = make_team(db_session, ash.user.id, old, 201)
    locked = service.lock_owned_team(db_session, ash.user.id, team.id)

    replaced = service.replace_member(db_session, locked, old, new)

    assert [(member.pokemon.id, member.pokemon.family_id) for member in replaced.members] == [
        (new, family),
        (201, 1201),
    ]


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
        for member in queries.get_team(db_session, team.id).members
    ] == [(201, 202, 1202), (203, 203, 1203)]
