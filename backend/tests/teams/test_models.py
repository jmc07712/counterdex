import uuid

import pytest
from sqlalchemy import delete, func, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.accounts.models import User
from app.accounts.types import SignedIn
from app.pokemon.models import Species, SpeciesVariety
from app.teams.models import Team, TeamMember
from tests.support.teams import add_species_pokemon


def add_team(session: Session, user_id: int, name: str = "Team 1") -> uuid.UUID:
    team = Team(id=uuid.uuid4(), user_id=user_id, name=name)
    session.add(team)
    session.flush()
    return team.id


def member(
    team_id: uuid.UUID, position: int, pokemon_id: int, species_id: int, family_id: int
) -> TeamMember:
    return TeamMember(
        team_id=team_id,
        position=position,
        pokemon_id=pokemon_id,
        species_id=species_id,
        family_id=family_id,
    )


def check_slots_now(session: Session) -> None:
    # The slot constraint is checked at commit, which these tests never reach.
    session.execute(text("set constraints uq_team_members_team_id_position immediate"))


def check_families_now(session: Session) -> None:
    # So is the family's foreign key.
    session.execute(text("set constraints fk_team_members_species_id_species immediate"))


def test_slots_run_from_0_to_5(db_session: Session, ash: SignedIn, charmander_family: None) -> None:
    team_id = add_team(db_session, ash.user.id)
    db_session.add(member(team_id, 6, 4, 4, 2))

    with pytest.raises(IntegrityError, match="ck_team_members_position_in_team"):
        db_session.flush()


def test_two_members_cant_share_a_slot(db_session: Session, ash: SignedIn) -> None:
    add_species_pokemon(db_session, 201, 202)
    team_id = add_team(db_session, ash.user.id)
    db_session.add_all([member(team_id, 0, 201, 201, 1201), member(team_id, 0, 202, 202, 1202)])
    db_session.flush()

    with pytest.raises(IntegrityError, match="uq_team_members_team_id_position"):
        check_slots_now(db_session)


def test_members_can_swap_slots_before_the_commit(db_session: Session, ash: SignedIn) -> None:
    add_species_pokemon(db_session, 201, 202)
    team_id = add_team(db_session, ash.user.id)
    db_session.add_all([member(team_id, 0, 201, 201, 1201), member(team_id, 1, 202, 202, 1202)])
    db_session.flush()

    # One statement, so for a moment both members are in the same slot.
    db_session.execute(update(TeamMember).values(position=1 - TeamMember.position))
    check_slots_now(db_session)

    slots = db_session.execute(select(TeamMember.position, TeamMember.pokemon_id))
    assert sorted(slots) == [(0, 202), (1, 201)]


@pytest.mark.parametrize(
    ("pokemon_id", "species_id"),
    [
        pytest.param(4, 4, id="earlier-stage"),
        pytest.param(10034, 6, id="other-form"),
    ],
)
def test_a_team_holds_one_pokemon_from_each_family(
    db_session: Session,
    ash: SignedIn,
    charmander_family: None,
    pokemon_id: int,
    species_id: int,
) -> None:
    team_id = add_team(db_session, ash.user.id)
    # Charmander, Charizard and Mega Charizard X are one evolution family (2).
    db_session.add_all([member(team_id, 0, 6, 6, 2), member(team_id, 1, pokemon_id, species_id, 2)])

    with pytest.raises(IntegrityError, match="uq_team_members_team_id_family_id"):
        db_session.flush()


def test_a_members_species_is_its_pokemons(
    db_session: Session, ash: SignedIn, charmander_family: None
) -> None:
    team_id = add_team(db_session, ash.user.id)
    db_session.add(member(team_id, 0, 4, species_id=6, family_id=2))

    with pytest.raises(IntegrityError, match="fk_team_members_pokemon_id_species_varieties"):
        db_session.flush()


def test_a_members_family_is_its_species(
    db_session: Session, ash: SignedIn, charmander_family: None
) -> None:
    team_id = add_team(db_session, ash.user.id)
    db_session.add(member(team_id, 0, 4, 4, family_id=67))
    db_session.flush()

    with pytest.raises(IntegrityError, match="fk_team_members_species_id_species"):
        check_families_now(db_session)


def test_a_member_can_be_between_families_until_the_commit(
    db_session: Session, ash: SignedIn
) -> None:
    add_species_pokemon(db_session, 201, 202)
    team_id = add_team(db_session, ash.user.id)
    db_session.add(member(team_id, 0, 201, 201, 1201))
    db_session.flush()

    # As a sync does when PokéAPI moves a Pokémon to a species in another family: the member
    # takes the new species at once, and its family is put right before the commit.
    db_session.execute(
        update(SpeciesVariety).where(SpeciesVariety.pokemon_id == 201).values(species_id=202)
    )
    db_session.execute(update(TeamMember).values(family_id=1202))
    check_families_now(db_session)

    assert db_session.execute(select(TeamMember.species_id, TeamMember.family_id)).one() == (
        202,
        1202,
    )


def test_a_member_follows_its_species_to_another_family(
    db_session: Session, ash: SignedIn, charmander_family: None
) -> None:
    team_id = add_team(db_session, ash.user.id)
    db_session.add(member(team_id, 0, 4, 4, 2))
    db_session.flush()

    db_session.execute(update(Species).where(Species.id == 4).values(evolution_chain_id=99))

    assert db_session.scalar(select(TeamMember.family_id)) == 99


@pytest.mark.parametrize("name", ["", "x" * 41])
def test_team_names_are_1_to_40_characters(db_session: Session, ash: SignedIn, name: str) -> None:
    db_session.add(Team(id=uuid.uuid4(), user_id=ash.user.id, name=name))

    with pytest.raises(IntegrityError, match="ck_teams_name_length"):
        db_session.flush()


def test_deleting_a_user_deletes_their_teams_and_members(
    db_session: Session, ash: SignedIn, charmander_family: None
) -> None:
    team_id = add_team(db_session, ash.user.id)
    db_session.add(member(team_id, 0, 4, 4, 2))
    db_session.flush()

    db_session.execute(delete(User))

    assert db_session.scalar(select(func.count()).select_from(Team)) == 0
    assert db_session.scalar(select(func.count()).select_from(TeamMember)) == 0
