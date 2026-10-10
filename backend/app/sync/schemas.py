"""The sync's shapes clients see: how up to date the Pokédex is."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

from app.sync.enums import SyncStatus


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
