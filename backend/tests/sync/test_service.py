from datetime import UTC, datetime
from typing import Any

import pytest
from sqlalchemy import Engine, func, select, text
from sqlalchemy.orm import Session

from app.pokemon.enums import PokemonType
from app.pokemon.models import Pokemon, Species, TypeMatchup
from app.sync.constants import SYNC_LOCK_KEY
from app.sync.enums import ChangeKind
from app.sync.exceptions import SyncAlreadyRunningError
from app.sync.models import PokemonChange, SyncRun
from app.sync.service import record_failed_sync, run_sync
from tests.support.pokeapi import BASE_URL, SPECIES_IDS, fake_pokeapi
from tests.support.pokemon import stored_varieties

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 10, 9, tzinfo=UTC)


def clock() -> datetime:
    return NOW


def count(session: Session, model: type[Pokemon | SyncRun | PokemonChange | TypeMatchup]) -> int:
    return session.scalar(select(func.count()).select_from(model)) or 0


async def test_syncs_pokeapi_into_the_database(db_session: Session) -> None:
    report = await run_sync(fake_pokeapi(), db_session, clock=clock)

    assert (report.fetched, report.inserted, report.failed) == (2, 2, [])
    assert count(db_session, Pokemon) == 2


async def test_skips_pokemon_with_data_the_table_would_refuse(db_session: Session) -> None:
    report = await run_sync(fake_pokeapi(speeds={25: 0}), db_session, clock=clock)

    assert (report.inserted, report.failed) == (1, ["pikachu"])


async def test_records_a_sync_run(db_session: Session) -> None:
    report = await run_sync(fake_pokeapi(failing=("pokemon/6",)), db_session, clock=clock)

    run = db_session.get(SyncRun, report.run_id)
    assert run is not None
    assert (run.status, run.inserted, run.failed) == ("succeeded", 1, [f"{BASE_URL}pokemon/6/"])
    assert (run.started_at, run.finished_at) == (NOW, NOW)


async def test_records_each_change_against_its_sync_run(db_session: Session) -> None:
    await run_sync(fake_pokeapi(), db_session, clock=clock)

    report = await run_sync(fake_pokeapi(speeds={25: 150}), db_session, clock=clock)

    change = db_session.scalars(select(PokemonChange)).one()
    assert (change.pokemon_id, change.kind, change.sync_run_id) == (
        25,
        ChangeKind.UPDATED,
        report.run_id,
    )
    assert change.before is not None
    assert change.after is not None
    assert (change.before["speed"], change.after["speed"]) == (90, 150)
    assert change.detected_at == NOW


async def test_a_second_sync_with_no_upstream_changes_records_no_changes(
    db_session: Session,
) -> None:
    await run_sync(fake_pokeapi(), db_session, clock=clock)

    report = await run_sync(fake_pokeapi(), db_session, clock=clock)

    assert (report.inserted, report.updated, report.unchanged) == (0, 0, 2)
    assert count(db_session, PokemonChange) == 0


async def test_leaves_committing_to_the_caller(db_session: Session) -> None:
    # Callers save the sync together with any related writes, so run_sync never commits.
    await run_sync(fake_pokeapi(), db_session, clock=clock)

    db_session.rollback()

    assert (count(db_session, Pokemon), count(db_session, SyncRun)) == (0, 0)


async def test_refuses_to_run_alongside_another_sync(
    db_session: Session, migrated_engine: Engine
) -> None:
    with migrated_engine.connect() as other:
        other.execute(text("select pg_advisory_lock(:key)"), {"key": SYNC_LOCK_KEY})
        try:
            with pytest.raises(SyncAlreadyRunningError):
                await run_sync(fake_pokeapi(), db_session, clock=clock)
        finally:
            other.execute(text("select pg_advisory_unlock(:key)"), {"key": SYNC_LOCK_KEY})


async def test_stores_a_pokemon_once_even_if_two_listing_urls_resolve_to_it(
    db_session: Session,
) -> None:
    # A second spelling of Pikachu's URL is a different listing entry with the same id.
    report = await run_sync(
        fake_pokeapi(extra_urls=(f"{BASE_URL}pokemon/25",)), db_session, clock=clock
    )

    assert report.inserted == 2
    assert count(db_session, Pokemon) == 2


async def test_syncs_species_and_their_evolution_families(db_session: Session) -> None:
    await run_sync(fake_pokeapi(), db_session, clock=clock)

    assert sorted(db_session.scalars(select(Species.id))) == sorted(SPECIES_IDS)
    raichu = db_session.get(Species, 26)
    assert raichu is not None
    assert (raichu.evolution_chain_id, raichu.evolves_from_species_id) == (10, 25)


async def test_links_each_synced_pokemon_to_its_species(db_session: Session) -> None:
    await run_sync(fake_pokeapi(), db_session, clock=clock)

    assert stored_varieties(db_session) == {6: 6, 25: 25}


async def test_reports_species_it_could_not_sync(db_session: Session) -> None:
    # Charmeleon failed to fetch, so none of its family is updated until the next sync.
    report = await run_sync(fake_pokeapi(failing=("pokemon-species/5",)), db_session, clock=clock)

    assert report.failed == ["charizard", "charmander", f"{BASE_URL}pokemon-species/5/"]
    assert sorted(db_session.scalars(select(Species.id))) == [25, 26, 172]


async def test_syncs_how_much_damage_each_type_does_to_each_other(db_session: Session) -> None:
    await run_sync(fake_pokeapi(), db_session, clock=clock)

    assert count(db_session, TypeMatchup) == len(PokemonType) ** 2
    water_on_fire = db_session.get(TypeMatchup, (PokemonType.WATER, PokemonType.FIRE))
    assert water_on_fire is not None
    assert water_on_fire.multiplier == 2


async def test_keeps_the_stored_type_chart_when_a_type_fails(db_session: Session) -> None:
    await run_sync(fake_pokeapi(), db_session, clock=clock)

    def water_does_normal_damage(path: str, data: dict[str, Any]) -> None:
        if path == "type/water":
            data["damage_relations"]["double_damage_to"] = []

    report = await run_sync(
        fake_pokeapi(failing=("type/fire",), edit=water_does_normal_damage),
        db_session,
        clock=clock,
    )

    assert report.failed == [f"{BASE_URL}type/fire/"]
    water_on_fire = db_session.get(TypeMatchup, (PokemonType.WATER, PokemonType.FIRE))
    assert water_on_fire is not None
    db_session.refresh(water_on_fire)
    assert water_on_fire.multiplier == 2


def test_records_a_failed_sync(db_session: Session) -> None:
    run = record_failed_sync(db_session, started_at=NOW, error="PokéAPI is down", clock=clock)

    assert db_session.get(SyncRun, run.id) is run
    assert (run.status, run.error, run.fetched, run.failed) == ("failed", "PokéAPI is down", 0, [])
