"""How the API reports errors."""

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.teams.exceptions import (
    MemberNotFoundError,
    TeamConflictError,
    TeamNotFoundError,
    UnknownPokemonError,
)
from app.teams.schemas import TeamConflict

TEAM_NOT_FOUND = "You have no team with this id."
MEMBER_NOT_FOUND = "That Pokémon isn't on the team."
UNKNOWN_POKEMON = "No Pokémon has this id."


async def validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
    """FastAPI's 422 response, less each error's `input`, which can be a password."""
    errors = [
        {key: value for key, value in each.items() if key != "input"} for each in error.errors()
    ]
    return JSONResponse({"detail": jsonable_encoder(errors)}, status_code=422)


async def team_not_found(request: Request, error: TeamNotFoundError) -> JSONResponse:
    return JSONResponse({"detail": TEAM_NOT_FOUND}, status_code=404)


async def member_not_found(request: Request, error: MemberNotFoundError) -> JSONResponse:
    return JSONResponse({"detail": MEMBER_NOT_FOUND}, status_code=404)


async def unknown_pokemon(request: Request, error: UnknownPokemonError) -> JSONResponse:
    return JSONResponse({"detail": UNKNOWN_POKEMON}, status_code=422)


async def team_conflict(request: Request, error: TeamConflictError) -> JSONResponse:
    """409, saying why as a TeamConflict, which the app words."""
    body = TeamConflict(reason=error.reason).model_dump(mode="json")
    return JSONResponse(body, status_code=409)
