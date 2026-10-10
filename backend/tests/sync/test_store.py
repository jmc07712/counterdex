from dataclasses import replace
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Pokemon
from app.sync.normalize import PokemonRecord
from app.sync.store import StoreResult, upsert_pokemon

FIRST_SYNC = datetime(2026, 10, 10, 9, tzinfo=UTC)
SECOND_SYNC = datetime(2026, 10, 11, 9, tzinfo=UTC)

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


def stored(session: Session, pokemon_id: int) -> Pokemon:
    pokemon = session.scalars(select(Pokemon).where(Pokemon.id == pokemon_id)).one()
    session.refresh(pokemon)
    return pokemon


def test_inserts_new_pokemon(db_session: Session) -> None:
    result = upsert_pokemon(db_session, [PIKACHU, CHARIZARD], synced_at=FIRST_SYNC)

    assert result == StoreResult(inserted=2, updated=0, unchanged=0)
    charizard = stored(db_session, 6)
    assert charizard.types == ["fire", "flying"]
    assert charizard.content_hash == CHARIZARD.content_hash()
    assert charizard.last_synced_at == FIRST_SYNC


def test_leaves_unchanged_pokemon_alone_but_records_the_sync(db_session: Session) -> None:
    upsert_pokemon(db_session, [PIKACHU, CHARIZARD], synced_at=FIRST_SYNC)

    result = upsert_pokemon(db_session, [PIKACHU, CHARIZARD], synced_at=SECOND_SYNC)

    assert result == StoreResult(inserted=0, updated=0, unchanged=2)
    assert stored(db_session, 25).last_synced_at == SECOND_SYNC


def test_updates_pokemon_whose_data_changed(db_session: Session) -> None:
    upsert_pokemon(db_session, [PIKACHU, CHARIZARD], synced_at=FIRST_SYNC)
    faster_pikachu = replace(PIKACHU, speed=150)

    result = upsert_pokemon(db_session, [faster_pikachu, CHARIZARD], synced_at=SECOND_SYNC)

    assert result == StoreResult(inserted=0, updated=1, unchanged=1)
    pikachu = stored(db_session, 25)
    assert pikachu.speed == 150
    assert pikachu.content_hash == faster_pikachu.content_hash()


def test_does_nothing_without_records(db_session: Session) -> None:
    assert upsert_pokemon(db_session, [], synced_at=FIRST_SYNC) == StoreResult(0, 0, 0)
