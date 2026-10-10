"""Run a sync end to end: fetch, normalize, store, and record the run and its changes."""

import logging
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.pokemon.schemas import Pokemon
from app.sync.client import PokeApiClient
from app.sync.constants import SYNC_LOCK_KEY
from app.sync.enums import SyncStatus
from app.sync.exceptions import SyncAlreadyRunningError
from app.sync.models import PokemonChange, SyncRun
from app.sync.normalize import normalize, normalize_species
from app.sync.store import store_pokemon, store_species
from app.sync.types import Clock, SyncReport

logger = logging.getLogger(__name__)


def utc_now() -> datetime:
    return datetime.now(UTC)


async def run_sync(
    client: PokeApiClient, session: Session, *, clock: Clock = utc_now
) -> SyncReport:
    """Fetch every Pokémon and species from PokéAPI, bring the tables up to date, and record
    the run and every change to a Pokémon it found.

    Doesn't commit: the caller owns the transaction, so the data, the changes and the run
    record are saved together or not at all.
    """
    # Held until the caller's transaction ends, so a scheduled and a manual sync can't overlap.
    if not session.scalar(select(func.pg_try_advisory_xact_lock(SYNC_LOCK_KEY))):
        raise SyncAlreadyRunningError("another sync is already running")

    started_at = clock()
    fetched = await client.fetch_pokemon()
    fetched_species = await client.fetch_species()
    failed = [*fetched.failed, *fetched_species.failed]

    # Keyed by id: two listing URLs can resolve to the same Pokémon, and the upsert must
    # touch each row only once.
    normalized: dict[int, Pokemon] = {}
    for raw in fetched.pokemon:
        try:
            normalized[raw.id] = normalize(raw)
        except ValueError as error:
            logger.warning("Skipping %s: %s", raw.name, error)
            failed.append(raw.name)

    result = store_pokemon(
        session,
        sorted(normalized.values(), key=lambda pokemon: pokemon.id),
        listed_ids=fetched.listed_ids,
        synced_at=started_at,
    )

    # After the Pokémon, so each species can link to the Pokémon that belong to it.
    species = normalize_species(fetched_species.species, fetched_species.evolution_chains)
    store_species(session, species)
    # Species whose family wasn't fetched whole keep what was stored before.
    stored = {each.id for each in species}
    failed += [each.name for each in fetched_species.species if each.id not in stored]

    run = SyncRun(
        started_at=started_at,
        finished_at=clock(),
        status=SyncStatus.SUCCEEDED,
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
        status=SyncStatus.FAILED,
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
