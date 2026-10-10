from dataclasses import replace
from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.pokemon.models import Pokemon
from app.sync.exceptions import SuspiciousRemovalError
from app.sync.normalize import content_hash
from app.sync.store import store_pokemon
from app.sync.types import Change, PokemonRecord, StoreResult

FIRST_SYNC = datetime(2026, 10, 10, 9, tzinfo=UTC)
SECOND_SYNC = datetime(2026, 10, 11, 9, tzinfo=UTC)
THIRD_SYNC = datetime(2026, 10, 12, 9, tzinfo=UTC)

PIKACHU = PokemonRecord(
    id=25,
    name="pikachu",
    types=("electric",),
    hp=35,
    attack=55,
    defense=40,
    sp_attack=50,
    sp_defense=50,
    speed=90,
    sprite_url="https://example.com/25.png",
    is_default=True,
)
CHARIZARD = replace(PIKACHU, id=6, name="charizard", types=("fire", "flying"), hp=78)
BOTH = {6, 25}


def snapshot(record: PokemonRecord) -> dict[str, object]:
    return {
        "name": record.name,
        "types": list(record.types),
        "hp": record.hp,
        "attack": record.attack,
        "defense": record.defense,
        "sp_attack": record.sp_attack,
        "sp_defense": record.sp_defense,
        "speed": record.speed,
        "sprite_url": record.sprite_url,
        "is_default": record.is_default,
    }


def stored(session: Session, pokemon_id: int) -> Pokemon:
    pokemon = session.scalars(select(Pokemon).where(Pokemon.id == pokemon_id)).one()
    session.refresh(pokemon)
    return pokemon


def first_sync(session: Session) -> None:
    store_pokemon(session, [PIKACHU, CHARIZARD], listed_ids=BOTH, synced_at=FIRST_SYNC)


def test_inserts_new_pokemon_without_recording_changes(db_session: Session) -> None:
    result = store_pokemon(db_session, [PIKACHU, CHARIZARD], listed_ids=BOTH, synced_at=FIRST_SYNC)

    assert (result.inserted, result.changes) == (2, [])
    charizard = stored(db_session, 6)
    assert charizard.types == ["fire", "flying"]
    assert charizard.content_hash == content_hash(CHARIZARD)
    assert charizard.last_synced_at == FIRST_SYNC


def test_leaves_unchanged_pokemon_alone_but_records_the_sync(db_session: Session) -> None:
    first_sync(db_session)

    result = store_pokemon(db_session, [PIKACHU, CHARIZARD], listed_ids=BOTH, synced_at=SECOND_SYNC)

    assert result == StoreResult(inserted=0, updated=0, unchanged=2, removed=0, restored=0)
    assert stored(db_session, 25).last_synced_at == SECOND_SYNC


def test_records_what_changed_before_overwriting_it(db_session: Session) -> None:
    first_sync(db_session)
    faster_pikachu = replace(PIKACHU, speed=150)

    result = store_pokemon(
        db_session, [faster_pikachu, CHARIZARD], listed_ids=BOTH, synced_at=SECOND_SYNC
    )

    assert result.updated == 1
    assert result.changes == [
        Change(25, "updated", before=snapshot(PIKACHU), after=snapshot(faster_pikachu))
    ]
    assert stored(db_session, 25).speed == 150


def test_marks_pokemon_missing_from_the_listing_as_removed(db_session: Session) -> None:
    first_sync(db_session)

    result = store_pokemon(db_session, [PIKACHU], listed_ids={25}, synced_at=SECOND_SYNC)

    assert result.removed == 1
    assert result.changes == [Change(6, "removed", before=snapshot(CHARIZARD), after=None)]
    assert stored(db_session, 6).removed_at == SECOND_SYNC


def test_keeps_listed_pokemon_that_failed_to_fetch(db_session: Session) -> None:
    # Charizard is still listed but its details couldn't be fetched: not a removal.
    first_sync(db_session)

    result = store_pokemon(db_session, [PIKACHU], listed_ids=BOTH, synced_at=SECOND_SYNC)

    assert (result.removed, result.changes) == (0, [])
    assert stored(db_session, 6).removed_at is None


def test_records_a_removal_only_once(db_session: Session) -> None:
    first_sync(db_session)
    store_pokemon(db_session, [PIKACHU], listed_ids={25}, synced_at=SECOND_SYNC)

    result = store_pokemon(db_session, [PIKACHU], listed_ids={25}, synced_at=THIRD_SYNC)

    assert (result.removed, result.changes) == (0, [])
    assert stored(db_session, 6).removed_at == SECOND_SYNC


def test_restores_a_pokemon_that_comes_back(db_session: Session) -> None:
    first_sync(db_session)
    store_pokemon(db_session, [PIKACHU], listed_ids={25}, synced_at=SECOND_SYNC)

    result = store_pokemon(db_session, [PIKACHU, CHARIZARD], listed_ids=BOTH, synced_at=THIRD_SYNC)

    assert result.restored == 1
    assert result.changes == [
        Change(6, "restored", before=snapshot(CHARIZARD), after=snapshot(CHARIZARD))
    ]
    assert stored(db_session, 6).removed_at is None


def test_refuses_to_remove_a_suspicious_number_of_pokemon(db_session: Session) -> None:
    # An empty or truncated listing from PokéAPI must not wipe out the Pokédex.
    many = [replace(PIKACHU, id=i, name=f"pokemon-{i}") for i in range(1, 21)]
    store_pokemon(db_session, many, listed_ids={p.id for p in many}, synced_at=FIRST_SYNC)

    with pytest.raises(SuspiciousRemovalError, match="20 of 20"):
        store_pokemon(db_session, [], listed_ids=set(), synced_at=SECOND_SYNC)

    assert stored(db_session, 1).removed_at is None


def test_does_nothing_without_records(db_session: Session) -> None:
    result = store_pokemon(db_session, [], listed_ids=set(), synced_at=FIRST_SYNC)

    assert result == StoreResult(inserted=0, updated=0, unchanged=0, removed=0, restored=0)
