"""Job: bring the pokemon table up to date with PokéAPI.

uv run --env-file ../.env python -m app.jobs.sync_pokemon
"""

import logging
import sys
from collections.abc import Callable

import anyio
import httpx2
from sqlalchemy.orm import Session

from app.core.db import get_engine
from app.sync.client import PokeApiClient
from app.sync.constants import POKEAPI_BASE_URL, REQUEST_TIMEOUT_SECONDS, USER_AGENT
from app.sync.service import record_failed_sync, run_sync, utc_now
from app.teams.service import follow_species_families

logger = logging.getLogger(__name__)


async def sync_pokemon(client: PokeApiClient, sessions: Callable[[], Session]) -> int:
    """Run one sync and save it; return the process exit code (0 only if nothing failed)."""
    started_at = utc_now()
    with sessions() as session:
        try:
            report = await run_sync(client, session)
            # Each team member moves to its species' evolution family, in the same transaction.
            follow_species_families(session)
            session.commit()
        # The job's outermost boundary: whatever went wrong, keep nothing from the attempt,
        # record that it failed, and exit non-zero.
        except Exception as error:
            session.rollback()
            logger.exception("Sync failed; no changes were saved.")
            record_failed_sync(
                session, started_at=started_at, error=f"{type(error).__name__}: {error}"
            )
            session.commit()
            return 1

    logger.info(
        "Fetched %d Pokémon: %d new, %d updated, %d removed, %d restored, %d unchanged.",
        report.fetched,
        report.inserted,
        report.updated,
        report.removed,
        report.restored,
        report.unchanged,
    )
    if report.failed:
        logger.error("%d could not be synced: %s", len(report.failed), ", ".join(report.failed))
        return 1
    return 0


async def main(transport: httpx2.AsyncBaseTransport | None = None) -> int:
    """Sync from PokéAPI over `transport`, which demo_changes replaces; by default, the network."""
    async with httpx2.AsyncClient(
        base_url=POKEAPI_BASE_URL,
        timeout=REQUEST_TIMEOUT_SECONDS,
        headers={"User-Agent": USER_AGENT},
        # Never follow redirects: they could lead outside PokéAPI.
        follow_redirects=False,
        transport=transport,
    ) as http:
        return await sync_pokemon(PokeApiClient(http), lambda: Session(get_engine()))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    # httpx2 logs every request at INFO; one line per Pokémon would bury the summary.
    logging.getLogger("httpx2").setLevel(logging.WARNING)
    sys.exit(anyio.run(main))
