import math
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, defer

from app.pokemon import schemas as pokemon_schemas
from app.pokemon.queries import pokemon_from_columns
from app.sync import models, schemas
from app.sync.enums import SyncStatus


def get_sync_overview(session: Session) -> schemas.SyncOverview:
    """When the Pokédex was last refreshed from PokéAPI, and how the most recent sync went."""
    # Runs are numbered in the order they're recorded.
    latest = session.scalars(
        select(models.SyncRun).order_by(models.SyncRun.id.desc()).limit(1)
    ).first()
    last_synced_at = session.scalar(
        select(func.max(models.SyncRun.finished_at)).where(
            models.SyncRun.status == SyncStatus.SUCCEEDED
        )
    )
    return schemas.SyncOverview(
        last_synced_at=last_synced_at,
        latest_run=_summarize(latest) if latest is not None else None,
    )


def _summarize(run: models.SyncRun) -> schemas.SyncRunSummary:
    return schemas.SyncRunSummary(
        status=run.status,
        started_at=run.started_at,
        finished_at=run.finished_at,
        inserted=run.inserted,
        updated=run.updated,
        removed=run.removed,
        restored=run.restored,
        failed=len(run.failed),
    )


def list_sync_runs(session: Session, query: schemas.SyncRunsQuery) -> schemas.SyncRunPage:
    """One page of the sync runs, newest first, with how many runs and pages there are.

    There is always at least one page, so an empty list is page 1 of 1. A page past the last has
    no runs.
    """
    total = session.execute(select(func.count()).select_from(models.SyncRun)).scalar_one()
    failed_count = func.jsonb_array_length(models.SyncRun.failed)
    rows = session.execute(
        select(models.SyncRun, failed_count)
        # Only the number of failures is shown, and the list can be long.
        .options(defer(models.SyncRun.failed))
        .order_by(models.SyncRun.started_at.desc(), models.SyncRun.id.desc())
        .limit(query.page_size)
        .offset((query.page - 1) * query.page_size)
    )
    return schemas.SyncRunPage(
        items=[
            schemas.SyncRunDetails(
                id=run.id,
                started_at=run.started_at,
                finished_at=run.finished_at,
                status=run.status,
                fetched=run.fetched,
                inserted=run.inserted,
                updated=run.updated,
                unchanged=run.unchanged,
                removed=run.removed,
                restored=run.restored,
                failed_count=count,
                error=run.error,
            )
            for run, count in rows
        ],
        page=query.page,
        page_size=query.page_size,
        total=total,
        total_pages=max(1, math.ceil(total / query.page_size)),
    )


def list_pokemon_changes(session: Session, pokemon_id: int) -> list[schemas.PokemonChange]:
    """Every change syncs have found to a Pokémon, newest first."""
    changes = session.scalars(
        select(models.PokemonChange)
        .where(models.PokemonChange.pokemon_id == pokemon_id)
        .order_by(models.PokemonChange.detected_at.desc(), models.PokemonChange.id.desc())
    )
    return [
        schemas.PokemonChange(
            kind=change.kind,
            detected_at=change.detected_at,
            before=_snapshot_pokemon(change.before, pokemon_id),
            after=_snapshot_pokemon(change.after, pokemon_id),
        )
        for change in changes
    ]


def _snapshot_pokemon(
    snapshot: dict[str, Any] | None, pokemon_id: int
) -> pokemon_schemas.Pokemon | None:
    """The Pokémon a change's snapshot recorded. Snapshots leave out the id they're filed under."""
    return None if snapshot is None else pokemon_from_columns({**snapshot, "id": pokemon_id})
