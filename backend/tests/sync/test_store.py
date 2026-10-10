from dataclasses import replace
from datetime import UTC, datetime

import pytest
from sqlalchemy.orm import Session

from app.core.db import Base
from app.pokemon import models, schemas
from app.pokemon.schemas import EvolutionMethod
from app.sync.enums import ChangeKind
from app.sync.exceptions import SuspiciousRemovalError
from app.sync.normalize import content_hash
from app.sync.store import store_pokemon, store_species
from app.sync.types import Change, SpeciesRecord, StoreResult
from tests.support.pokemon import (
    LEVEL_16,
    LEVEL_36,
    PIKACHU,
    add_pokemon,
    stored_varieties,
    with_columns,
)

FIRST_SYNC = datetime(2026, 10, 10, 9, tzinfo=UTC)
SECOND_SYNC = datetime(2026, 10, 11, 9, tzinfo=UTC)
THIRD_SYNC = datetime(2026, 10, 12, 9, tzinfo=UTC)

CHARIZARD = with_columns(PIKACHU, id=6, name="charizard", types=["fire", "flying"], hp=78)
BOTH = {6, 25}


def snapshot(pokemon: schemas.Pokemon) -> dict[str, object]:
    # Spelled out rather than derived, to pin the format already stored in pokemon_changes.
    return {
        "name": pokemon.name,
        "types": list(pokemon.types),
        "hp": pokemon.stats.hp,
        "attack": pokemon.stats.attack,
        "defense": pokemon.stats.defense,
        "sp_attack": pokemon.stats.sp_attack,
        "sp_defense": pokemon.stats.sp_defense,
        "speed": pokemon.stats.speed,
        "sprite_url": pokemon.sprite_url,
        "is_default": pokemon.is_default,
    }


def stored[T: Base](session: Session, model: type[T], row_id: int) -> T:
    """A row as the database holds it now: the store writes past the session's loaded rows."""
    row = session.get(model, row_id)
    assert row is not None
    session.refresh(row)
    return row


@pytest.fixture
def first_sync(db_session: Session) -> None:
    """Pikachu and Charizard, stored by a first sync."""
    store_pokemon(db_session, [PIKACHU, CHARIZARD], listed_ids=BOTH, synced_at=FIRST_SYNC)


@pytest.fixture
def charizard_removed(db_session: Session, first_sync: None) -> None:
    """Charizard, removed by a second sync because PokéAPI no longer listed it."""
    store_pokemon(db_session, [PIKACHU], listed_ids={25}, synced_at=SECOND_SYNC)


def test_inserts_new_pokemon_without_recording_changes(db_session: Session) -> None:
    result = store_pokemon(db_session, [PIKACHU, CHARIZARD], listed_ids=BOTH, synced_at=FIRST_SYNC)

    assert (result.inserted, result.changes) == (2, [])
    charizard = stored(db_session, models.Pokemon, 6)
    assert charizard.types == ["fire", "flying"]
    assert charizard.content_hash == content_hash(CHARIZARD)
    assert charizard.last_synced_at == FIRST_SYNC
    # Joining the Pokédex isn't a change.
    assert charizard.last_changed_at is None


@pytest.mark.usefixtures("first_sync")
def test_leaves_unchanged_pokemon_alone_but_records_the_sync(db_session: Session) -> None:
    result = store_pokemon(db_session, [PIKACHU, CHARIZARD], listed_ids=BOTH, synced_at=SECOND_SYNC)

    assert result == StoreResult(inserted=0, updated=0, unchanged=2, removed=0, restored=0)
    pikachu = stored(db_session, models.Pokemon, 25)
    assert (pikachu.last_synced_at, pikachu.last_changed_at) == (SECOND_SYNC, None)


@pytest.mark.usefixtures("first_sync")
def test_records_what_changed_before_overwriting_it(db_session: Session) -> None:
    faster_pikachu = with_columns(PIKACHU, speed=150)

    result = store_pokemon(
        db_session, [faster_pikachu, CHARIZARD], listed_ids=BOTH, synced_at=SECOND_SYNC
    )

    assert result.updated == 1
    assert result.changes == [
        Change(25, ChangeKind.UPDATED, before=snapshot(PIKACHU), after=snapshot(faster_pikachu))
    ]
    pikachu = stored(db_session, models.Pokemon, 25)
    assert (pikachu.speed, pikachu.last_changed_at) == (150, SECOND_SYNC)


@pytest.mark.usefixtures("first_sync")
def test_marks_pokemon_missing_from_the_listing_as_removed(db_session: Session) -> None:
    result = store_pokemon(db_session, [PIKACHU], listed_ids={25}, synced_at=SECOND_SYNC)

    assert result.removed == 1
    assert result.changes == [Change(6, ChangeKind.REMOVED, before=snapshot(CHARIZARD), after=None)]
    charizard = stored(db_session, models.Pokemon, 6)
    assert (charizard.removed_at, charizard.last_changed_at) == (SECOND_SYNC, SECOND_SYNC)


@pytest.mark.usefixtures("first_sync")
def test_keeps_listed_pokemon_that_failed_to_fetch(db_session: Session) -> None:
    # Charizard is still listed but its details couldn't be fetched: not a removal.
    result = store_pokemon(db_session, [PIKACHU], listed_ids=BOTH, synced_at=SECOND_SYNC)

    assert (result.removed, result.changes) == (0, [])
    assert stored(db_session, models.Pokemon, 6).removed_at is None


@pytest.mark.usefixtures("charizard_removed")
def test_records_a_removal_only_once(db_session: Session) -> None:
    result = store_pokemon(db_session, [PIKACHU], listed_ids={25}, synced_at=THIRD_SYNC)

    assert (result.removed, result.changes) == (0, [])
    charizard = stored(db_session, models.Pokemon, 6)
    assert (charizard.removed_at, charizard.last_changed_at) == (SECOND_SYNC, SECOND_SYNC)


@pytest.mark.usefixtures("charizard_removed")
def test_restores_a_pokemon_that_comes_back(db_session: Session) -> None:
    result = store_pokemon(db_session, [PIKACHU, CHARIZARD], listed_ids=BOTH, synced_at=THIRD_SYNC)

    assert result.restored == 1
    assert result.changes == [
        Change(6, ChangeKind.RESTORED, before=snapshot(CHARIZARD), after=snapshot(CHARIZARD))
    ]
    charizard = stored(db_session, models.Pokemon, 6)
    assert (charizard.removed_at, charizard.last_changed_at) == (None, THIRD_SYNC)


def test_refuses_to_remove_a_suspicious_number_of_pokemon(db_session: Session) -> None:
    # An empty or truncated listing from PokéAPI must not wipe out the Pokédex.
    add_pokemon(db_session, *range(1, 21))

    with pytest.raises(SuspiciousRemovalError, match="20 of 20"):
        store_pokemon(db_session, [], listed_ids=set(), synced_at=SECOND_SYNC)

    assert stored(db_session, models.Pokemon, 1).removed_at is None


def test_does_nothing_without_pokemon(db_session: Session) -> None:
    result = store_pokemon(db_session, [], listed_ids=set(), synced_at=FIRST_SYNC)

    assert result == StoreResult(inserted=0, updated=0, unchanged=0, removed=0, restored=0)


# --- Species ---

CHARMANDER = SpeciesRecord(
    id=4,
    name="charmander",
    genus="Lizard Pokémon",
    evolution_chain_id=2,
    evolves_from_species_id=None,
    evolution_methods=(),
    pokemon_ids=(4,),
)
CHARMELEON = replace(
    CHARMANDER,
    id=5,
    name="charmeleon",
    genus="Flame Pokémon",
    evolves_from_species_id=4,
    evolution_methods=(LEVEL_16,),
    pokemon_ids=(5,),
)
CHARIZARD_SPECIES = replace(
    CHARMELEON,
    id=6,
    name="charizard",
    evolves_from_species_id=5,
    evolution_methods=(LEVEL_36,),
    pokemon_ids=(6, 10034),
)
CHARMANDER_FAMILY = [CHARMANDER, CHARMELEON, CHARIZARD_SPECIES]


def test_stores_species_and_their_place_in_their_family(db_session: Session) -> None:
    add_pokemon(db_session, 4, 5, 6, 10034)

    store_species(db_session, CHARMANDER_FAMILY)

    charizard = stored(db_session, models.Species, 6)
    assert (charizard.name, charizard.genus) == ("charizard", "Flame Pokémon")
    assert (charizard.evolution_chain_id, charizard.evolves_from_species_id) == (2, 5)
    methods = [EvolutionMethod.model_validate(method) for method in charizard.evolution_methods]
    assert methods == [LEVEL_36]


def test_stores_which_species_each_pokemon_belongs_to(db_session: Session) -> None:
    add_pokemon(db_session, 4, 5, 6, 10034)

    store_species(db_session, CHARMANDER_FAMILY)

    assert stored_varieties(db_session) == {4: 4, 5: 5, 6: 6, 10034: 6}


def test_leaves_out_pokemon_that_are_not_stored(db_session: Session) -> None:
    # Mega Charizard X (10034) failed to sync; a later sync adds it to its species.
    add_pokemon(db_session, 4, 5, 6)

    store_species(db_session, CHARMANDER_FAMILY)

    assert stored_varieties(db_session) == {4: 4, 5: 5, 6: 6}


def test_overwrites_species_already_stored(db_session: Session) -> None:
    add_pokemon(db_session, 4, 5, 6, 10034)
    store_species(db_session, CHARMANDER_FAMILY)

    store_species(db_session, [replace(CHARIZARD_SPECIES, genus="Blaze Pokémon")])

    assert stored(db_session, models.Species, 6).genus == "Blaze Pokémon"
