from collections.abc import Callable, Sequence
from typing import Any

import pytest
from sqlalchemy import Connection, Row, func, select
from sqlalchemy.orm import Session, sessionmaker

from app.accounts import service as accounts
from app.jobs.sync_pokemon import sync_pokemon
from app.pokemon.models import Pokemon
from app.sync.enums import SyncStatus
from app.sync.models import SyncRun
from app.teams.models import TeamMember
from tests.support.accounts import ASH
from tests.support.pokeapi import BASE_URL, fake_pokeapi
from tests.support.teams import make_team

pytestmark = pytest.mark.anyio


@pytest.fixture
def sessions(connection: Connection) -> Callable[[], Session]:
    """Sessions whose commits stay inside the test's transaction, which is rolled back."""
    return lambda: Session(bind=connection, join_transaction_mode="create_savepoint")


def counts(sessions: Callable[[], Session]) -> tuple[int, list[SyncStatus]]:
    with sessions() as session:
        pokemon = session.scalar(select(func.count()).select_from(Pokemon)) or 0
        statuses = list(session.scalars(select(SyncRun.status).order_by(SyncRun.id)))
    return pokemon, statuses


def members(sessions: Callable[[], Session]) -> Sequence[Row[int, int, int]]:
    """Every team member's Pokémon, species and family, in slot order."""
    with sessions() as session:
        return session.execute(
            select(TeamMember.pokemon_id, TeamMember.species_id, TeamMember.family_id).order_by(
                TeamMember.position
            )
        ).all()


async def sync_with_a_team(sessions: Callable[[], Session], *pokemon_ids: int) -> None:
    """Syncs PokéAPI as it is, then saves a team of these Pokémon for Ash."""
    await sync_pokemon(fake_pokeapi(), sessions)
    with sessions() as session:
        make_team(session, accounts.sign_up(session, ASH).user.id, *pokemon_ids)
        session.commit()


def charizard_joins_raichus_species(path: str, data: dict[str, Any]) -> None:
    """PokéAPI lists Charizard (6) as a form of Raichu (26), in Pikachu's family (10)."""
    if path == "pokemon-species/6":
        data["varieties"] = [
            variety for variety in data["varieties"] if variety["pokemon"]["name"] != "charizard"
        ]
    elif path == "pokemon-species/26":
        data["varieties"].append(
            {"is_default": False, "pokemon": {"name": "charizard", "url": f"{BASE_URL}pokemon/6/"}}
        )


def pikachus_family_joins_charizards(path: str, data: dict[str, Any]) -> None:
    """PokéAPI gives Pikachu's evolution family (10) the id of Charizard's (2)."""
    if path == "evolution-chain/10":
        data["id"] = 2


async def test_saves_a_successful_sync_and_exits_zero(sessions: Callable[[], Session]) -> None:
    exit_code = await sync_pokemon(fake_pokeapi(), sessions)

    assert exit_code == 0
    assert counts(sessions) == (2, [SyncStatus.SUCCEEDED])


async def test_exits_non_zero_when_some_pokemon_failed(sessions: Callable[[], Session]) -> None:
    exit_code = await sync_pokemon(fake_pokeapi(failing=("pokemon/6",)), sessions)

    assert exit_code == 1
    # What did sync is still saved; the failure is on the run record.
    assert counts(sessions) == (1, [SyncStatus.SUCCEEDED])


async def test_keeps_nothing_and_records_the_failure_when_the_sync_fails(
    sessions: Callable[[], Session],
) -> None:
    exit_code = await sync_pokemon(fake_pokeapi(failing=("pokemon",)), sessions)

    assert exit_code == 1
    assert counts(sessions) == (0, [SyncStatus.FAILED])


async def test_moves_a_team_member_to_the_family_of_its_pokemons_new_species(
    committing_sessions: sessionmaker[Session],
) -> None:
    await sync_with_a_team(committing_sessions, 6)

    exit_code = await sync_pokemon(
        fake_pokeapi(edit=charizard_joins_raichus_species), committing_sessions
    )

    assert (exit_code, counts(committing_sessions)) == (
        0,
        (2, [SyncStatus.SUCCEEDED, SyncStatus.SUCCEEDED]),
    )
    assert members(committing_sessions) == [(6, 26, 10)]


async def test_fails_a_sync_that_would_give_a_team_two_pokemon_from_one_family(
    committing_sessions: sessionmaker[Session],
) -> None:
    # Charizard and Pikachu share a team, so making their families one would break the family
    # rule. The sync fails and is rolled back, rather than taking a Pokémon off the team.
    await sync_with_a_team(committing_sessions, 6, 25)

    exit_code = await sync_pokemon(
        fake_pokeapi(edit=pikachus_family_joins_charizards), committing_sessions
    )

    assert (exit_code, counts(committing_sessions)) == (
        1,
        (2, [SyncStatus.SUCCEEDED, SyncStatus.FAILED]),
    )
    assert members(committing_sessions) == [(6, 6, 2), (25, 25, 10)]
