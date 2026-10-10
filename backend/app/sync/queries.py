from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.sync.enums import SyncStatus
from app.sync.models import SyncRun
from app.sync.schemas import SyncOverview, SyncRunSummary


def get_sync_overview(session: Session) -> SyncOverview:
    """When the Pokédex was last refreshed from PokéAPI, and how the most recent sync went."""
    # Runs are numbered in the order they're recorded.
    latest = session.scalars(select(SyncRun).order_by(SyncRun.id.desc()).limit(1)).first()
    last_synced_at = session.scalar(
        select(func.max(SyncRun.finished_at)).where(SyncRun.status == SyncStatus.SUCCEEDED)
    )
    return SyncOverview(
        last_synced_at=last_synced_at,
        latest_run=_summarize(latest) if latest is not None else None,
    )


def _summarize(run: SyncRun) -> SyncRunSummary:
    return SyncRunSummary(
        status=run.status,
        started_at=run.started_at,
        finished_at=run.finished_at,
        inserted=run.inserted,
        updated=run.updated,
        removed=run.removed,
        restored=run.restored,
        failed=len(run.failed),
    )
