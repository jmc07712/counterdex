import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Path, Response, status

from app.api.caching import never_cache
from app.api.dependencies import NOT_SIGNED_IN, CurrentUser, SessionDep
from app.api.errors import TEAM_NOT_FOUND, UNKNOWN_POKEMON
from app.teams import service
from app.teams.schemas import NewTeam, Team, TeamConflict, TeamRename

router = APIRouter(dependencies=[Depends(never_cache)])

TeamId = Annotated[uuid.UUID, Path(description="The team's `id`: a UUID its creator chose.")]

SIGN_IN: dict[int | str, dict[str, Any]] = {
    status.HTTP_401_UNAUTHORIZED: {"description": NOT_SIGNED_IN}
}
NOT_YOURS: dict[int | str, dict[str, Any]] = {
    status.HTTP_404_NOT_FOUND: {"description": TEAM_NOT_FOUND}
}
CONFLICT: dict[int | str, dict[str, Any]] = {
    status.HTTP_409_CONFLICT: {
        "model": TeamConflict,
        "description": "The change can't be made to the team as it is now; `reason` says why.",
    }
}
UNKNOWN: dict[int | str, dict[str, Any]] = {
    status.HTTP_422_UNPROCESSABLE_CONTENT: {"description": f"{UNKNOWN_POKEMON} Or invalid input."}
}


@router.get("/teams", summary="List your teams", responses=SIGN_IN)
def list_teams(session: SessionDep, user: CurrentUser) -> list[Team]:
    """Your teams, most recently changed first, each with its Pokémon in slot order."""
    return service.list_teams(session, user.id)


@router.put(
    "/teams/{team_id}",
    summary="Create a team",
    responses={
        status.HTTP_201_CREATED: {"model": Team, "description": "The team was created."},
        **SIGN_IN,
        **CONFLICT,
        **UNKNOWN,
    },
)
def create_team(
    session: SessionDep, user: CurrentUser, response: Response, team_id: TeamId, team: NewTeam
) -> Team:
    """Creates a team with the `id` you choose, a new UUID, and any Pokémon to start with.

    Sending the same `id` again returns the team it made, unchanged, with 200 instead of 201, so
    a create that's retried can't make two teams. An `id` someone else has is a 409.
    """
    created_team, created = service.create_team(session, user.id, team_id, team)
    session.commit()
    if created:
        response.status_code = status.HTTP_201_CREATED
    return created_team


@router.get("/teams/{team_id}", summary="Get a team", responses={**SIGN_IN, **NOT_YOURS})
def get_team(session: SessionDep, user: CurrentUser, team_id: TeamId) -> Team:
    """One of your teams, with its Pokémon in slot order."""
    return service.get_team(session, user.id, team_id)


@router.patch("/teams/{team_id}", summary="Rename a team", responses={**SIGN_IN, **NOT_YOURS})
def rename_team(
    session: SessionDep, user: CurrentUser, team_id: TeamId, rename: TeamRename
) -> Team:
    """Gives one of your teams a new name."""
    renamed = service.rename_team(session, user.id, team_id, rename.name)
    session.commit()
    return renamed


@router.delete(
    "/teams/{team_id}",
    summary="Delete a team",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**SIGN_IN, **NOT_YOURS},
)
def delete_team(session: SessionDep, user: CurrentUser, team_id: TeamId) -> None:
    """Deletes one of your teams."""
    service.delete_team(session, user.id, team_id)
    session.commit()
