from collections.abc import Sequence
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import Pokemon
from app.sync.normalize import PokemonRecord

# Every column except the id, which identifies the row being written.
WRITABLE_COLUMNS = tuple(column.name for column in Pokemon.__table__.columns if column.name != "id")


@dataclass(frozen=True)
class StoreResult:
    inserted: int
    updated: int
    unchanged: int


def upsert_pokemon(
    session: Session, records: Sequence[PokemonRecord], *, synced_at: datetime
) -> StoreResult:
    """Insert new Pokémon, rewrite changed ones, and stamp unchanged ones as synced.

    Comparing content hashes means unchanged rows are never rewritten.
    """
    stored_hashes = dict(session.execute(select(Pokemon.id, Pokemon.content_hash)).all())
    new = [record for record in records if record.id not in stored_hashes]
    changed = [
        record
        for record in records
        if record.id in stored_hashes and stored_hashes[record.id] != record.content_hash()
    ]
    unchanged_ids = [
        record.id for record in records if stored_hashes.get(record.id) == record.content_hash()
    ]

    if new or changed:
        statement = insert(Pokemon).values([_row(record, synced_at) for record in new + changed])
        session.execute(
            statement.on_conflict_do_update(
                index_elements=[Pokemon.id],
                set_={column: statement.excluded[column] for column in WRITABLE_COLUMNS},
            )
        )
    if unchanged_ids:
        session.execute(
            update(Pokemon).where(Pokemon.id.in_(unchanged_ids)).values(last_synced_at=synced_at)
        )

    return StoreResult(inserted=len(new), updated=len(changed), unchanged=len(unchanged_ids))


def _row(record: PokemonRecord, synced_at: datetime) -> dict[str, Any]:
    return asdict(record) | {
        "types": list(record.types),
        "content_hash": record.content_hash(),
        "last_synced_at": synced_at,
    }
