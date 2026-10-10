"""Bring the pokemon table up to date with PokéAPI.

uv run --env-file .env python -m app.sync
"""

import logging
import sys

import anyio
import httpx2
from sqlalchemy.orm import Session

from app.core.db import get_engine
from app.sync.pokeapi import POKEAPI_BASE_URL, PokeApiClient
from app.sync.run import record_failed_sync, run_sync, utc_now

logger = logging.getLogger("app.sync")

# PokéAPI's fair-use policy asks clients to identify themselves.
USER_AGENT = "counterdex-sync (+https://github.com/jmc07712/counterdex)"


async def main() -> int:
    started_at = utc_now()
    async with httpx2.AsyncClient(
        base_url=POKEAPI_BASE_URL,
        timeout=15,
        headers={"User-Agent": USER_AGENT},
        # Never follow redirects: they could lead outside PokéAPI.
        follow_redirects=False,
    ) as http:
        with Session(get_engine()) as session:
            try:
                report = await run_sync(PokeApiClient(http), session)
                session.commit()
            # This is the command's outermost boundary: whatever went wrong, keep nothing from
            # the attempt, record that it failed, and exit non-zero.
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


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    # httpx2 logs every request at INFO; one line per Pokémon would bury the summary.
    logging.getLogger("httpx2").setLevel(logging.WARNING)
    sys.exit(anyio.run(main))
