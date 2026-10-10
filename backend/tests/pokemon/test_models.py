from datetime import UTC, datetime
from typing import Any

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.pokemon.models import Pokemon


def make_pokemon(**overrides: Any) -> Pokemon:
    fields: dict[str, Any] = {
        "id": 25,
        "name": "pikachu",
        "types": ["electric"],
        "hp": 35,
        "attack": 55,
        "defense": 40,
        "sp_attack": 50,
        "sp_defense": 50,
        "speed": 90,
        "sprite_url": "https://example.com/25.png",
        "is_default": True,
        "content_hash": "0" * 64,
        "last_synced_at": datetime(2026, 10, 10, tzinfo=UTC),
    }
    return Pokemon(**(fields | overrides))


def test_stores_and_loads_a_pokemon(db_session: Session) -> None:
    db_session.add(make_pokemon(id=6, name="charizard", types=["fire", "flying"]))
    db_session.flush()
    db_session.expunge_all()

    loaded = db_session.get(Pokemon, 6)

    assert loaded is not None
    assert loaded.name == "charizard"
    assert loaded.types == ["fire", "flying"]


def test_sprite_is_optional(db_session: Session) -> None:
    db_session.add(make_pokemon(sprite_url=None))
    db_session.flush()


@pytest.mark.parametrize("types", [[], ["fire", "flying", "dragon"]])
def test_rejects_anything_but_one_or_two_types(db_session: Session, types: list[str]) -> None:
    db_session.add(make_pokemon(types=types))

    with pytest.raises(IntegrityError, match="ck_pokemon_one_or_two_types"):
        db_session.flush()


@pytest.mark.parametrize("hp", [0, 256])
def test_rejects_base_stats_outside_1_to_255(db_session: Session, hp: int) -> None:
    db_session.add(make_pokemon(hp=hp))

    with pytest.raises(IntegrityError, match="ck_pokemon_hp_in_range"):
        db_session.flush()


def test_names_are_unique(db_session: Session) -> None:
    db_session.add(make_pokemon(id=25))
    db_session.flush()
    db_session.add(make_pokemon(id=10080))

    with pytest.raises(IntegrityError, match="uq_pokemon_name"):
        db_session.flush()
