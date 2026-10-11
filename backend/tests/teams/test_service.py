import uuid

import pytest
from sqlalchemy import func, update
from sqlalchemy.orm import Session

from app.accounts.types import SignedIn
from app.pokemon.models import Pokemon
from app.teams import service
from app.teams.enums import TeamConflictReason
from app.teams.exceptions import TeamConflictError, TeamNotFoundError, UnknownPokemonError
from app.teams.schemas import NewTeam
from tests.support.teams import add_eevee_family, add_species_pokemon, make_team, member_ids

TEAM_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")

# --- Creating ---


@pytest.mark.usefixtures("charmander_family")
def test_creates_a_team_with_its_pokemon_in_order(db_session: Session, ash: SignedIn) -> None:
    team, created = service.create_team(
        db_session, ash.user.id, TEAM_ID, NewTeam(name="Fire", pokemon_ids=[6, 4])
    )

    assert created is True
    assert (team.id, team.name) == (TEAM_ID, "Fire")
    assert [(member.position, member.pokemon.id) for member in team.members] == [(0, 6), (1, 4)]
    assert [member.pokemon.species_id for member in team.members] == [6, 4]


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
    assert len(service.list_teams(db_session, ash.user.id)) == 1


def test_an_id_another_user_has_is_taken(
    db_session: Session, ash: SignedIn, misty: SignedIn
) -> None:
    service.create_team(db_session, misty.user.id, TEAM_ID, NewTeam(name="Water"))

    with pytest.raises(TeamConflictError) as conflict:
        service.create_team(db_session, ash.user.id, TEAM_ID, NewTeam(name="Fire"))

    assert conflict.value.reason is TeamConflictReason.TEAM_ID_TAKEN


@pytest.mark.usefixtures("charmander_family")
def test_creating_follows_the_species_clause(db_session: Session, ash: SignedIn) -> None:
    with pytest.raises(TeamConflictError) as conflict:
        service.create_team(
            db_session, ash.user.id, TEAM_ID, NewTeam(name="Fire", pokemon_ids=[6, 10034])
        )

    assert conflict.value.reason is TeamConflictReason.SPECIES_ON_TEAM


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


def test_lists_your_teams_most_recently_changed_first(
    db_session: Session, ash: SignedIn, misty: SignedIn
) -> None:
    older = make_team(db_session, ash.user.id, name="Older")
    newer = make_team(db_session, ash.user.id, name="Newer")
    make_team(db_session, misty.user.id, name="Misty's")

    service.rename_team(db_session, ash.user.id, older.id, "Renamed")

    assert [team.name for team in service.list_teams(db_session, ash.user.id)] == [
        "Renamed",
        newer.name,
    ]


def test_another_users_team_isnt_found(db_session: Session, ash: SignedIn, misty: SignedIn) -> None:
    team = make_team(db_session, misty.user.id)

    with pytest.raises(TeamNotFoundError):
        service.get_team(db_session, ash.user.id, team.id)


# --- Relatives ---


@pytest.mark.usefixtures("charmander_family")
def test_earlier_and_later_stages_are_related(db_session: Session, ash: SignedIn) -> None:
    team = make_team(db_session, ash.user.id, 4, 5, 10034)

    related = {member.pokemon.id: member.related_pokemon_ids for member in team.members}
    assert related == {4: [5, 10034], 5: [4, 10034], 10034: [4, 5]}


def test_branches_of_one_family_arent_related(db_session: Session, ash: SignedIn) -> None:
    add_eevee_family(db_session)

    team = make_team(db_session, ash.user.id, 134, 135, 133)

    related = {member.pokemon.id: member.related_pokemon_ids for member in team.members}
    assert related == {134: [133], 135: [133], 133: [134, 135]}


# --- Renaming and deleting ---


def test_renaming_changes_the_name_and_when_it_changed(db_session: Session, ash: SignedIn) -> None:
    team = make_team(db_session, ash.user.id)

    renamed = service.rename_team(db_session, ash.user.id, team.id, "Rain")

    assert renamed.name == "Rain"
    assert renamed.updated_at > team.updated_at


@pytest.mark.usefixtures("charmander_family")
def test_deleting_removes_the_team(db_session: Session, ash: SignedIn) -> None:
    team = make_team(db_session, ash.user.id, 4)

    service.delete_team(db_session, ash.user.id, team.id)

    assert service.list_teams(db_session, ash.user.id) == []


def test_you_cant_rename_or_delete_another_users_team(
    db_session: Session, ash: SignedIn, misty: SignedIn
) -> None:
    team = make_team(db_session, misty.user.id)

    with pytest.raises(TeamNotFoundError):
        service.rename_team(db_session, ash.user.id, team.id, "Mine now")
    with pytest.raises(TeamNotFoundError):
        service.delete_team(db_session, ash.user.id, team.id)


@pytest.mark.usefixtures("charmander_family")
def test_member_ids_lists_slot_order(db_session: Session, ash: SignedIn) -> None:
    assert member_ids(make_team(db_session, ash.user.id, 6, 4, 5)) == [6, 4, 5]


def test_creates_a_full_team(db_session: Session, ash: SignedIn) -> None:
    add_species_pokemon(db_session, 201, 202, 203, 204, 205, 206)

    team = make_team(db_session, ash.user.id, 201, 202, 203, 204, 205, 206)

    assert member_ids(team) == [201, 202, 203, 204, 205, 206]
