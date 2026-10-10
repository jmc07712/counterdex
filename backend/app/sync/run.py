import logging
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.orm import Session

from app.sync.normalize import PokemonRecord, normalize
from app.sync.pokeapi import PokeApiClient
from app.sync.store import upsert_pokemon

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SyncReport:
    fetched: int
    inserted: int
    updated: int
    unchanged: int
    # PokéAPI URLs (or names, for unusable data) of Pokémon that couldn't be synced.
    failed: list[str] = field(default_factory=list)


async def run_sync(client: PokeApiClient, session: Session, *, now: datetime) -> SyncReport:
    """Fetch every Pokémon from PokéAPI and bring the pokemon table up to date.

    Doesn't commit: the caller owns the transaction, so it can save the sync together with
    any related writes, or roll everything back.
    """
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

    result = upsert_pokemon(session, sorted(records.values(), key=lambda r: r.id), synced_at=now)

    return SyncReport(
        fetched=len(fetched.pokemon),
        inserted=result.inserted,
        updated=result.updated,
        unchanged=result.unchanged,
        failed=sorted(failed),
    )
