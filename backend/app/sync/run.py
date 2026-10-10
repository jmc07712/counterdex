import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import PokemonChange, SyncRun
from app.sync.normalize import PokemonRecord, normalize
from app.sync.pokeapi import PokeApiClient
from app.sync.store import store_pokemon

logger = logging.getLogger(__name__)

# Postgres advisory lock that lets only one sync write at a time (any constant works).
SYNC_LOCK_KEY = 4_202_510

Clock = Callable[[], datetime]


def utc_now() -> datetime:
    return datetime.now(UTC)


class SyncAlreadyRunningError(Exception):
    """Another sync holds the lock; this one would race it."""


@dataclass(frozen=True)
class SyncReport:
    run_id: int
    fetched: int
    inserted: int
    updated: int
    unchanged: int
    removed: int
    restored: int
    # PokéAPI URLs (or names, for unusable data) of Pokémon that couldn't be synced.
    failed: list[str] = field(default_factory=list)


async def run_sync(
    client: PokeApiClient, session: Session, *, clock: Clock = utc_now
) -> SyncReport:
    """Fetch every Pokémon from PokéAPI, bring the pokemon table up to date, and record the
    run and every change it found.

    Doesn't commit: the caller owns the transaction, so the data, the changes and the run
    record are saved together or not at all.
    """
    # Held until the caller's transaction ends, so a scheduled and a manual sync can't overlap.
    if not session.scalar(select(func.pg_try_advisory_xact_lock(SYNC_LOCK_KEY))):
        raise SyncAlreadyRunningError("another sync is already running")

    started_at = clock()
    fetched = await client.fetch_all()
    failed = list(fetched.failed)

    # Keyed by id: two listing URLs can resolve to the same Pokémon, and the upsert must
    # touch each row only once.
    records: dict[int, PokemonRecord] = {}
    for raw in fetched.pokemon:
        try:
            records[raw.id] = normalize(raw)
        except ValueError as error:
            logger.warning("Skipping %s: %s", raw.name, error)
            failed.append(raw.name)

    result = store_pokemon(
        session,
        sorted(records.values(), key=lambda r: r.id),
        listed_ids=fetched.listed_ids,
        synced_at=started_at,
    )

    run = SyncRun(
        started_at=started_at,
        finished_at=clock(),
        status="succeeded",
        fetched=len(fetched.pokemon),
        inserted=result.inserted,
        updated=result.updated,
        unchanged=result.unchanged,
        removed=result.removed,
        restored=result.restored,
        failed=sorted(failed),
    )
    session.add(run)
    session.flush()
    session.add_all(
        PokemonChange(
            pokemon_id=change.pokemon_id,
            sync_run_id=run.id,
            detected_at=started_at,
            kind=change.kind,
            before=change.before,
            after=change.after,
        )
        for change in result.changes
    )
    session.flush()

    return SyncReport(
        run_id=run.id,
        fetched=run.fetched,
        inserted=run.inserted,
        updated=run.updated,
        unchanged=run.unchanged,
        removed=run.removed,
        restored=run.restored,
        failed=run.failed,
    )


def record_failed_sync(
    session: Session, *, started_at: datetime, error: str, clock: Clock = utc_now
) -> SyncRun:
    """Record a sync that failed. Call it after rolling back the failed sync's transaction."""
    run = SyncRun(
        started_at=started_at,
        finished_at=clock(),
        status="failed",
        fetched=0,
        inserted=0,
        updated=0,
        unchanged=0,
        removed=0,
        restored=0,
        failed=[],
        error=error,
    )
    session.add(run)
    session.flush()
    return run
