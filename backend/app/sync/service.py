"""Run a sync end to end: fetch, normalize, store, and record the run and its changes."""

import logging
from collections.abc import Iterable
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.pokemon.schemas import Pokemon
from app.sync.client import PokeApiClient
from app.sync.constants import SYNC_LOCK_KEY
from app.sync.enums import SyncStatus
from app.sync.exceptions import SyncAlreadyRunningError
from app.sync.models import PokemonChange, SyncRun
from app.sync.normalize import normalize_pokemon, normalize_species, normalize_type_chart
from app.sync.pokeapi import PokeApiPokemon
from app.sync.store import store_pokemon, store_species, store_type_chart
from app.sync.types import Clock, StoreResult, SyncReport

logger = logging.getLogger(__name__)


def utc_now() -> datetime:
    return datetime.now(UTC)


async def run_sync(
    client: PokeApiClient, session: Session, *, clock: Clock = utc_now
) -> SyncReport:
    """Fetch every Pokémon, species and type from PokéAPI, bring the tables up to date, and
    record the run and every change to a Pokémon it found.

    Doesn't commit: the caller owns the transaction, so the data, the changes and the run
    record are saved together or not at all. Before committing, the caller must also call
    `teams.service.follow_species_families`, which puts each team member in its species'
    evolution family.
    """
    # Held until the caller's transaction ends, so a scheduled and a manual sync can't overlap.
    if not session.scalar(select(func.pg_try_advisory_xact_lock(SYNC_LOCK_KEY))):
        raise SyncAlreadyRunningError("another sync is already running")

    started_at = clock()
    fetched = await client.fetch_pokemon()
    fetched_species = await client.fetch_species()
    fetched_types = await client.fetch_types()
    failed = [*fetched.failed, *fetched_species.failed, *fetched_types.failed]

    pokemon, unusable = _normalize_all(fetched.pokemon)
    failed += unusable
    result = store_pokemon(session, pokemon, listed_ids=fetched.listed_ids, synced_at=started_at)

    # After the Pokémon, so each species can link to the Pokémon that belong to it.
    species = normalize_species(fetched_species.species, fetched_species.evolution_chains)
    store_species(session, species)
    # Species whose family wasn't fetched whole keep what was stored before.
    stored = {each.id for each in species}
    failed += [each.name for each in fetched_species.species if each.id not in stored]

    # Stored whole or not at all: if a type failed to fetch, the chart stored before is kept.
    store_type_chart(session, normalize_type_chart(fetched_types.types))

    run = _record_run(
        session,
        result,
        started_at=started_at,
        finished_at=clock(),
        fetched=len(fetched.pokemon),
        failed=failed,
    )
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


def _normalize_all(fetched: Iterable[PokeApiPokemon]) -> tuple[list[Pokemon], list[str]]:
    """The fetched Pokémon our table would accept, by id, and the names of those it wouldn't."""
    # Keyed by id: two listing URLs can resolve to the same Pokémon, and the upsert must
    # touch each row only once.
    normalized: dict[int, Pokemon] = {}
    unusable: list[str] = []
    for raw in fetched:
        try:
            normalized[raw.id] = normalize_pokemon(raw)
        except ValueError as error:
            logger.warning("Skipping %s: %s", raw.name, error)
            unusable.append(raw.name)
    return sorted(normalized.values(), key=lambda pokemon: pokemon.id), unusable


def _record_run(
    session: Session,
    result: StoreResult,
    *,
    started_at: datetime,
    finished_at: datetime,
    fetched: int,
    failed: list[str],
) -> SyncRun:
    """Record a sync that succeeded, and every change to a Pokémon it found."""
    run = SyncRun(
        started_at=started_at,
        finished_at=finished_at,
        status=SyncStatus.SUCCEEDED,
        fetched=fetched,
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
    return run


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
