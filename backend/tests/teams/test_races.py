"""Changes to one team from two places at once: the second waits for the first to commit, then
sees what it did.
"""

import time
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import Engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.accounts import service as accounts
from app.pokemon.models import SpeciesVariety
from app.teams import service
from app.teams.enums import TeamConflictReason
from app.teams.exceptions import TeamConflictError
from app.teams.schemas import NewTeam
from tests.support.accounts import ASH
from tests.support.pokemon import make_pokemon
from tests.support.teams import add_species_pokemon


def wait_until_a_session_waits_for_a_lock(engine: Engine) -> None:
    deadline = time.monotonic() + 10
    with engine.connect() as connection:
        while not connection.scalar(text("select exists (select from pg_locks where not granted)")):
            if time.monotonic() > deadline:
                raise TimeoutError("no session waited for a lock")
            time.sleep(0.01)


def setup_team(sessions: sessionmaker[Session], *pokemon_ids: int) -> tuple[int, uuid.UUID]:
    """Ash with a team of these Pokémon, committed. Returns Ash's id and the team's.

    Pokémon 201 to 207 exist, and 10201 is a second form of 201's species.
    """
    with sessions() as session:
        add_species_pokemon(session, 201, 202, 203, 204, 205, 206, 207)
        session.add(make_pokemon(id=10201, name="pokemon-201-other-form", is_default=False))
        session.flush()
        session.add(SpeciesVariety(pokemon_id=10201, species_id=201))
        user_id = accounts.sign_up(session, ASH).user.id
        team_id = uuid.uuid4()
        service.create_team(
            session, user_id, team_id, NewTeam(name="Team 1", pokemon_ids=list(pokemon_ids))
        )
        session.commit()
    return user_id, team_id


def second_change(
    sessions: sessionmaker[Session], change: Callable[[Session], object]
) -> TeamConflictReason | None:
    """Makes a change in a new session and commits it: None if it was made, or why it wasn't."""
    with sessions() as session:
        try:
            change(session)
        except TeamConflictError as error:
            return error.reason
        session.commit()
    return None


def race(
    sessions: sessionmaker[Session],
    engine: Engine,
    first: Callable[[Session], object],
    second: Callable[[Session], object],
) -> TeamConflictReason | None:
    """Makes `first` and holds it uncommitted while `second` starts, waits until `second` is
    waiting for a lock, then commits `first`. Returns what became of `second`.
    """
    with sessions() as first_session, ThreadPoolExecutor(1) as pool:
        first(first_session)
        later = pool.submit(second_change, sessions, second)
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
        lambda session: service.add_member(session, user_id, team_id, 206),
        lambda session: service.add_member(session, user_id, team_id, 207),
    )

    assert outcome is TeamConflictReason.TEAM_FULL


def test_a_second_add_of_the_same_species_finds_it_on_the_team(
    committing_sessions: sessionmaker[Session], migrated_engine: Engine
) -> None:
    user_id, team_id = setup_team(committing_sessions, 202)

    outcome = race(
        committing_sessions,
        migrated_engine,
        lambda session: service.add_member(session, user_id, team_id, 201),
        lambda session: service.add_member(session, user_id, team_id, 10201),
    )

    assert outcome is TeamConflictReason.SPECIES_ON_TEAM


def test_a_reorder_made_before_a_removal_is_out_of_date(
    committing_sessions: sessionmaker[Session], migrated_engine: Engine
) -> None:
    user_id, team_id = setup_team(committing_sessions, 201, 202, 203)

    outcome = race(
        committing_sessions,
        migrated_engine,
        lambda session: service.remove_member(session, user_id, team_id, 201),
        lambda session: service.reorder(session, user_id, team_id, [203, 202, 201]),
    )

    assert outcome is TeamConflictReason.ORDER_OUT_OF_DATE
