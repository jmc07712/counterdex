"""Changes to one team from two places at once. Each locks the team with lock_owned_team first, as
require_team_owner does for a request, so the second waits for the first to commit, then sees what
it did. One test leaves the lock out, to show that the database refuses what the service's checks
can't see.
"""

import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.accounts import service as accounts
from app.teams import models, service
from app.teams.enums import TeamConflictReason
from app.teams.exceptions import TeamConflictError
from app.teams.schemas import NewTeam
from tests.support.accounts import ASH
from tests.support.pokemon import add_species, make_pokemon
from tests.support.teams import add_species_pokemon, wait_until_a_session_waits_for_a_lock

# A change to a team, made once lock_owned_team has locked it.
Change = Callable[[Session, models.Team], object]


def setup_team(sessions: sessionmaker[Session], *pokemon_ids: int) -> tuple[int, uuid.UUID]:
    """Ash with a team of these Pokémon, committed. Returns Ash's id and the team's.

    Pokémon 201 to 207 exist, each of its own family, and 208 evolves from 201, in 201's family.
    """
    with sessions() as session:
        add_species_pokemon(session, 201, 202, 203, 204, 205, 206, 207)
        session.add(make_pokemon(id=208, name="pokemon-208"))
        session.flush()
        add_species(session, 208, family=1201, evolves_from=201, pokemon_ids=[208])
        user_id = accounts.sign_up(session, ASH).user.id
        team_id = uuid.uuid4()
        service.create_team(
            session, user_id, team_id, NewTeam(name="Team 1", pokemon_ids=list(pokemon_ids))
        )
        session.commit()
    return user_id, team_id


def second_change(
    sessions: sessionmaker[Session], user_id: int, team_id: uuid.UUID, change: Change
) -> TeamConflictReason | None:
    """Locks the user's team in a new session, makes a change and commits it: None if it was
    made, or why it wasn't.
    """
    with sessions() as session:
        try:
            change(session, service.lock_owned_team(session, user_id, team_id))
        except TeamConflictError as error:
            return error.reason
        session.commit()
    return None


def add_without_the_lock(
    sessions: sessionmaker[Session], team_id: uuid.UUID, pokemon_id: int
) -> TeamConflictReason | None:
    """Adds a Pokémon to the team in a new session without locking the team first, and commits:
    None if it was added, or why it wasn't.
    """
    with sessions() as session:
        team = session.get(models.Team, team_id)
        assert team is not None
        try:
            service.add_member(session, team, pokemon_id)
        except TeamConflictError as error:
            return error.reason
        session.commit()
    return None


def race(
    sessions: sessionmaker[Session],
    engine: Engine,
    user_id: int,
    team_id: uuid.UUID,
    first: Change,
    second: Change,
) -> TeamConflictReason | None:
    """Locks the user's team and makes `first`, holding it uncommitted while `second` starts;
    waits until `second` is waiting for a lock, then commits `first`. Returns what became of
    `second`.
    """
    with sessions() as first_session, ThreadPoolExecutor(1) as pool:
        first(first_session, service.lock_owned_team(first_session, user_id, team_id))
        later = pool.submit(second_change, sessions, user_id, team_id, second)
        wait_until_a_session_waits_for_a_lock(engine)
        first_session.commit()
        return later.result(timeout=10)


def test_a_second_add_to_a_team_of_five_finds_it_full(
    committing_sessions: sessionmaker[Session], migrated_engine: Engine
) -> None:
    user_id, team_id = setup_team(committing_sessions, 201, 202, 203, 204, 205)

    outcome = race(
        committing_sessions,
        migrated_engine,
        user_id,
        team_id,
        lambda session, team: service.add_member(session, team, 206),
        lambda session, team: service.add_member(session, team, 207),
    )

    assert outcome is TeamConflictReason.TEAM_FULL


def test_a_second_add_from_the_same_family_finds_it_on_the_team(
    committing_sessions: sessionmaker[Session], migrated_engine: Engine
) -> None:
    user_id, team_id = setup_team(committing_sessions, 202)

    outcome = race(
        committing_sessions,
        migrated_engine,
        user_id,
        team_id,
        lambda session, team: service.add_member(session, team, 201),
        lambda session, team: service.add_member(session, team, 208),
    )

    assert outcome is TeamConflictReason.FAMILY_ON_TEAM


def test_a_reorder_made_before_a_removal_is_out_of_date(
    committing_sessions: sessionmaker[Session], migrated_engine: Engine
) -> None:
    user_id, team_id = setup_team(committing_sessions, 201, 202, 203)

    outcome = race(
        committing_sessions,
        migrated_engine,
        user_id,
        team_id,
        lambda session, team: service.remove_member(session, team, 201),
        lambda session, team: service.reorder(session, team, [203, 202, 201]),
    )

    assert outcome is TeamConflictReason.ORDER_OUT_OF_DATE


def test_the_database_refuses_a_family_member_the_check_couldnt_see(
    committing_sessions: sessionmaker[Session], migrated_engine: Engine
) -> None:
    user_id, team_id = setup_team(committing_sessions, 202)

    with ThreadPoolExecutor(1) as pool, committing_sessions() as first:
        service.add_member(first, service.lock_owned_team(first, user_id, team_id), 201)
        # Without the lock, this add reads the team before 201 is committed, so its own check
        # passes; its insert then waits on the family constraint until the first commits.
        later = pool.submit(add_without_the_lock, committing_sessions, team_id, 208)
        wait_until_a_session_waits_for_a_lock(migrated_engine)
        first.commit()
        outcome = later.result(timeout=10)

    assert outcome is TeamConflictReason.FAMILY_ON_TEAM
