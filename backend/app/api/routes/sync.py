from fastapi import APIRouter, Response

from app.api.caching import cache_publicly
from app.api.constants import SYNC_STATUS_CACHE_CONTROL
from app.api.dependencies import SessionDep
from app.sync import queries
from app.sync.schemas import SyncOverview

router = APIRouter()


@router.get("/sync/status", summary="Sync status")
def sync_status(session: SessionDep, response: Response) -> SyncOverview:
    """When the Pokédex data last came from PokéAPI, and how the most recent sync went."""
    cache_publicly(response, SYNC_STATUS_CACHE_CONTROL)
    return queries.get_sync_overview(session)
