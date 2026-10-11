"""The sync's shapes clients see: how up to date the Pokédex is, and what changed."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.pokemon.schemas import Pokemon
from app.sync.constants import DEFAULT_RUNS_PAGE_SIZE, MAX_RUNS_PAGE, MAX_RUNS_PAGE_SIZE
from app.sync.enums import ChangeKind, SyncStatus


class SyncRunSummary(BaseModel):
    """One sync with PokéAPI."""

    status: SyncStatus
    started_at: datetime
    finished_at: datetime
    inserted: Annotated[int, Field(description="Pokémon new to the Pokédex.")]
    updated: Annotated[int, Field(description="Pokémon whose data changed.")]
    removed: Annotated[int, Field(description="Pokémon PokéAPI no longer lists.")]
    restored: Annotated[int, Field(description="Removed Pokémon that PokéAPI lists again.")]
    failed: Annotated[int, Field(description="Pokémon that couldn't be synced this time.")]


class SyncOverview(BaseModel):
    """How up to date the Pokédex is."""

    last_synced_at: Annotated[
        datetime | None,
        Field(
            description="When the Pokédex data last came from PokéAPI: the end of the latest "
            "successful sync, or `null` before the first one."
        ),
    ]
    latest_run: Annotated[
        SyncRunSummary | None, Field(description="The most recent sync, successful or not.")
    ]


class SyncRunsQuery(BaseModel):
    """Which page of the sync runs to list."""

    model_config = ConfigDict(frozen=True)

    page: Annotated[
        int,
        Field(
            ge=1,
            le=MAX_RUNS_PAGE,
            description="Which page, counting from 1. A page past the last one is empty.",
        ),
    ] = 1
    page_size: Annotated[
        int, Field(ge=1, le=MAX_RUNS_PAGE_SIZE, description="How many runs per page.")
    ] = DEFAULT_RUNS_PAGE_SIZE


class SyncRunDetails(BaseModel):
    """One sync with PokéAPI, successful or not, with everything it counted."""

    id: Annotated[int, Field(description="Runs are numbered in the order they were recorded.")]
    started_at: datetime
    finished_at: datetime
    status: SyncStatus
    fetched: Annotated[int, Field(description="Pokémon fetched from PokéAPI.")]
    inserted: Annotated[int, Field(description="Pokémon new to the Pokédex.")]
    updated: Annotated[int, Field(description="Pokémon whose data changed.")]
    unchanged: Annotated[int, Field(description="Pokémon whose data was already up to date.")]
    removed: Annotated[int, Field(description="Pokémon PokéAPI no longer lists.")]
    restored: Annotated[int, Field(description="Removed Pokémon that PokéAPI lists again.")]
    failed_count: Annotated[
        int, Field(description="Pokémon, species and types that couldn't be synced this time.")
    ]
    error: Annotated[
        str | None,
        Field(
            description="What went wrong when the whole run failed, or `null` when it ran to "
            "the end, even if some of what it fetched couldn't be synced."
        ),
    ]


class SyncRunPage(BaseModel):
    """One page of sync runs."""

    items: Annotated[list[SyncRunDetails], Field(description="This page's runs, newest first.")]
    page: Annotated[int, Field(description="This page's number, counting from 1.")]
    page_size: Annotated[
        int, Field(description="How many runs a full page holds; the last page can hold fewer.")
    ]
    total: Annotated[int, Field(description="How many runs there are in all.")]
    total_pages: Annotated[
        int, Field(description="How many pages there are: at least 1, even with no runs.")
    ]


class PokemonChange(BaseModel):
    """A change a sync found to a Pokémon, with the Pokémon as it was before and after."""

    kind: ChangeKind
    detected_at: Annotated[datetime, Field(description="When the sync that found it started.")]
    before: Annotated[Pokemon | None, Field(description="The Pokémon before the change.")]
    after: Annotated[
        Pokemon | None,
        Field(description="The Pokémon after the change, or `null` if it was removed."),
    ]
