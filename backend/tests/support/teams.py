"""Pokémon, species and teams for the teams tests."""

import time
import uuid
from datetime import timedelta

from sqlalchemy import Engine, func, text, update
from sqlalchemy.orm import Session

from app.teams import models, service
from app.teams.schemas import NewTeam, Team
from tests.support.pokemon import add_species, make_pokemon


def add_species_pokemon(session: Session, *ids: int) -> None:
    """Saves a Pokémon for each id, each the only one of its own species and family.

    Ids from 201 up don't clash with the conftest fixtures' Pokémon or species.
    """
    session.add_all(make_pokemon(id=pokemon_id, name=f"pokemon-{pokemon_id}") for pokemon_id in ids)
    session.flush()
    for pokemon_id in ids:
        add_species(session, pokemon_id, family=1000 + pokemon_id, pokemon_ids=[pokemon_id])


def add_eevee_family(session: Session) -> None:
    """Eevee (133), which evolves into Vaporeon (134) or Jolteon (135): one family, two branches."""
    session.add_all(
        [
            make_pokemon(id=133, name="eevee", types=["normal"]),
            make_pokemon(id=134, name="vaporeon", types=["water"]),
            make_pokemon(id=135, name="jolteon", types=["electric"]),
        ]
    )
    session.flush()
    add_species(session, 133, family=67, pokemon_ids=[133], name="eevee")
    add_species(session, 134, family=67, evolves_from=133, pokemon_ids=[134], name="vaporeon")
    add_species(session, 135, family=67, evolves_from=133, pokemon_ids=[135], name="jolteon")


def add_mr_mime(session: Session) -> None:
    """Mr. Mime (122), whose name has a hyphen, the only Pokémon of its own species and family."""
    session.add(make_pokemon(id=122, name="mr-mime", types=["psychic", "fairy"]))
    session.flush()
    add_species(session, 122, family=52, pokemon_ids=[122], name="mr-mime")


def make_team(session: Session, user_id: int, *pokemon_ids: int, name: str = "Team 1") -> Team:
    """Creates a team for the user with these Pokémon, in this order."""
    team, _ = service.create_team(
        session, user_id, uuid.uuid4(), NewTeam(name=name, pokemon_ids=list(pokemon_ids))
    )
    return team


def backdate(session: Session, team_id: uuid.UUID, age: timedelta) -> None:
    """Makes the team's created_at `age` before now, as if it had been made then."""
    session.execute(
        update(models.Team).where(models.Team.id == team_id).values(created_at=func.now() - age)
    )


def member_ids(team: Team) -> list[int]:
    """The team's Pokémon ids, in slot order."""
    return [member.pokemon.id for member in team.members]


def wait_until_a_session_waits_for_a_lock(engine: Engine) -> None:
    """Returns once a session is waiting for a lock that another holds, or fails after 10s."""
    deadline = time.monotonic() + 10
    with engine.connect() as connection:
        while not connection.scalar(text("select exists (select from pg_locks where not granted)")):
            if time.monotonic() > deadline:
                raise TimeoutError("no session waited for a lock")
            time.sleep(0.01)
