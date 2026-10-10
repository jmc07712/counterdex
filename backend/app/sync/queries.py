from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

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
