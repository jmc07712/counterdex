from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.caching import cache_publicly
from app.api.constants import SYNC_STATUS_CACHE_CONTROL
from app.api.dependencies import NOT_ADMIN, NOT_SIGNED_IN, AdminUser, SessionDep
from app.api.tags import SYNC
from app.sync import queries
from app.sync.schemas import SyncOverview, SyncRunPage, SyncRunsQuery

router = APIRouter(tags=[SYNC])


@router.get("/sync/status", summary="Sync status")
def sync_status(session: SessionDep, response: Response) -> SyncOverview:
    """When the Pokédex data last came from PokéAPI, and how the most recent sync went."""
    cache_publicly(response, SYNC_STATUS_CACHE_CONTROL)
    return queries.get_sync_overview(session)


@router.get(
    "/sync/runs",
    summary="List every sync run (admins only)",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": NOT_SIGNED_IN},
        status.HTTP_403_FORBIDDEN: {"description": NOT_ADMIN},
    },
)
def list_sync_runs(
    session: SessionDep, admin: AdminUser, query: Annotated[SyncRunsQuery, Query()]
) -> SyncRunPage:
    """Every sync with PokéAPI, successful or not, newest first, one page at a time. Only admins
    can see it.

    The response says which `page` this is and how many `total_pages` there are: at least 1, so
    a list with no runs is page 1 of 1. A page past the last has no runs, and isn't an error.
    """
    return queries.list_sync_runs(session, query)
