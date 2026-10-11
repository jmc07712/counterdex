from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.api.caching import cache_publicly
from app.api.constants import COUNTER_TEAM_CACHE_CONTROL
from app.api.dependencies import SessionDep
from app.api.tags import COUNTER_TEAM
from app.counter import service
from app.counter.exceptions import (
    TooFewCandidatesError,
    TypeChartMissingError,
    UnknownPokemonError,
)
from app.counter.schemas import Challenger, TeamMatchupQuery

router = APIRouter(tags=[COUNTER_TEAM])

UNKNOWN_POKEMON = "No Pokémon has one or more of these ids."
TYPE_CHART_MISSING = (
    "The type chart hasn't been synced from PokéAPI yet, so no matchup can be worked out. Run a "
    "sync first."
)
TOO_FEW_CANDIDATES = "Too few Pokémon have been synced to choose a team from. Run a sync first."
NOT_SYNCED: dict[int | str, dict[str, Any]] = {
    status.HTTP_503_SERVICE_UNAVAILABLE: {
        "description": "The Pokédex hasn't been synced enough to answer: run a sync first."
    }
}


@contextmanager
def counter_errors() -> Iterator[None]:
    """Turns the counter service's errors into the HTTP errors the routes document."""
    try:
        yield
    except UnknownPokemonError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, UNKNOWN_POKEMON) from None
    except TypeChartMissingError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, TYPE_CHART_MISSING) from None
    except TooFewCandidatesError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, TOO_FEW_CANDIDATES) from None


@router.get("/counter-team", summary="Find a counter team", responses=NOT_SYNCED)
def find_counter_team(
    session: SessionDep, response: Response, query: Annotated[TeamMatchupQuery, Query()]
) -> list[Challenger]:
    """A team as big as the given one that beats it, for a saved team or a guest's draft.

    Each of our Pokémon is matched one-on-one against each of theirs: both at level 50, each
    attacking every turn with its strongest move of its own types, until one is knocked out. A
    matchup's `verdict` is `counter` if ours can switch in, take a free hit and still win,
    `check` if it wins only from a neutral start, and otherwise `loses`.

    The team gives each of theirs the best answer it can, ideally a counter, and a backup, and
    avoids letting one of theirs beat three or more of ours. It has one Pokémon from each
    evolution family, so it can be saved as a team. It comes in battle order: our lead answers
    their lead, and the rest follow the order of the Pokémon they answer best.

    Alternate forms, and legendary and mythical Pokémon, are left out unless asked for. Their
    team may have Pokémon that PokéAPI no longer lists; ours never does. An `id` with no
    Pokémon is a 422.
    """
    with counter_errors():
        team = service.find_counter_team(session, query)
    cache_publicly(response, COUNTER_TEAM_CACHE_CONTROL)
    return team


@router.get("/team-threats", summary="List the threats to a team", responses=NOT_SYNCED)
def list_team_threats(
    session: SessionDep, response: Response, query: Annotated[TeamMatchupQuery, Query()]
) -> list[Challenger]:
    """Up to 12 Pokémon that beat the most of a team one-on-one, as a counter or a check (see
    Find a counter team), each with how it fares against each of the team's Pokémon. Those that
    beat the most come first, then those with the most HP left after winning.

    Alternate forms, and legendary and mythical Pokémon, are left out unless asked for. An `id`
    with no Pokémon is a 422.
    """
    with counter_errors():
        threats = service.list_team_threats(session, query)
    cache_publicly(response, COUNTER_TEAM_CACHE_CONTROL)
    return threats
