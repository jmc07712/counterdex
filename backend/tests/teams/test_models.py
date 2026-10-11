import uuid

import pytest
from sqlalchemy import delete, func, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.accounts.models import User
from app.accounts.types import SignedIn
from app.teams.models import Team, TeamMember


def add_team(session: Session, user_id: int, name: str = "Team 1") -> uuid.UUID:
    team = Team(id=uuid.uuid4(), user_id=user_id, name=name)
    session.add(team)
    session.flush()
    return team.id


def member(team_id: uuid.UUID, position: int, pokemon_id: int, species_id: int) -> TeamMember:
    return TeamMember(
        team_id=team_id, position=position, pokemon_id=pokemon_id, species_id=species_id
    )


def check_slots_now(session: Session) -> None:
    # The slot constraint is checked at commit, which these tests never reach.
    session.execute(text("set constraints uq_team_members_team_id_position immediate"))


def test_slots_run_from_0_to_5(db_session: Session, ash: SignedIn, charmander_family: None) -> None:
    team_id = add_team(db_session, ash.user.id)
    db_session.add(member(team_id, 6, 4, 4))

    with pytest.raises(IntegrityError, match="ck_team_members_position_in_team"):
        db_session.flush()


def test_two_members_cant_share_a_slot(
    db_session: Session, ash: SignedIn, charmander_family: None
) -> None:
    team_id = add_team(db_session, ash.user.id)
    db_session.add_all([member(team_id, 0, 4, 4), member(team_id, 0, 5, 5)])
    db_session.flush()

    with pytest.raises(IntegrityError, match="uq_team_members_team_id_position"):
        check_slots_now(db_session)


def test_members_can_swap_slots_before_the_commit(
    db_session: Session, ash: SignedIn, charmander_family: None
) -> None:
    team_id = add_team(db_session, ash.user.id)
    db_session.add_all([member(team_id, 0, 4, 4), member(team_id, 1, 5, 5)])
    db_session.flush()

    # One statement, so for a moment both members are in the same slot.
    db_session.execute(update(TeamMember).values(position=1 - TeamMember.position))
    check_slots_now(db_session)

    slots = db_session.execute(select(TeamMember.position, TeamMember.pokemon_id))
    assert sorted(slots) == [(0, 5), (1, 4)]


def test_a_team_holds_one_of_each_species(
    db_session: Session, ash: SignedIn, charmander_family: None
) -> None:
    team_id = add_team(db_session, ash.user.id)
    # Charizard and Mega Charizard X are both the species Charizard (6).
    db_session.add_all([member(team_id, 0, 6, 6), member(team_id, 1, 10034, 6)])

    with pytest.raises(IntegrityError, match="uq_team_members_team_id_species_id"):
        db_session.flush()


def test_a_members_species_is_its_pokemons(
    db_session: Session, ash: SignedIn, charmander_family: None
) -> None:
    team_id = add_team(db_session, ash.user.id)
    db_session.add(member(team_id, 0, 4, species_id=6))

    with pytest.raises(IntegrityError, match="fk_team_members_pokemon_id_species_varieties"):
        db_session.flush()


@pytest.mark.parametrize("name", ["", "x" * 41])
def test_team_names_are_1_to_40_characters(db_session: Session, ash: SignedIn, name: str) -> None:
    db_session.add(Team(id=uuid.uuid4(), user_id=ash.user.id, name=name))

    with pytest.raises(IntegrityError, match="ck_teams_name_length"):
        db_session.flush()


def test_deleting_a_user_deletes_their_teams_and_members(
    db_session: Session, ash: SignedIn, charmander_family: None
) -> None:
    team_id = add_team(db_session, ash.user.id)
    db_session.add(member(team_id, 0, 4, 4))
    db_session.flush()

    db_session.execute(delete(User))

    assert db_session.scalar(select(func.count()).select_from(Team)) == 0
    assert db_session.scalar(select(func.count()).select_from(TeamMember)) == 0
