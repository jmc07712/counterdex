import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status

from app.api.caching import never_cache
from app.api.dependencies import NOT_SIGNED_IN, CurrentUser, SessionDep
from app.pokemon.constants import MAX_POKEMON_ID
from app.teams import service
from app.teams.exceptions import (
    MemberNotFoundError,
    TeamConflictError,
    TeamNotFoundError,
    UnknownPokemonError,
)
from app.teams.schemas import NewMember, NewTeam, Team, TeamConflict, TeamOrder, TeamRename

router = APIRouter(dependencies=[Depends(never_cache)])

TEAM_NOT_FOUND = "You have no team with this id."
MEMBER_NOT_FOUND = "That Pokémon isn't on the team."
UNKNOWN_POKEMON = "No Pokémon has this id."

TeamId = Annotated[uuid.UUID, Path(description="The team's `id`: a UUID its creator chose.")]
MemberId = Annotated[
    int, Path(ge=1, le=MAX_POKEMON_ID, description="The member's Pokémon `id`, e.g. 6.")
]


@contextmanager
def team_errors() -> Iterator[None]:
    """Turns the teams service's errors into the HTTP errors the routes document."""
    try:
        yield
    except TeamNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, TEAM_NOT_FOUND) from None
    except MemberNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, MEMBER_NOT_FOUND) from None
    except UnknownPokemonError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, UNKNOWN_POKEMON) from None
    except TeamConflictError as conflict:
        raise HTTPException(status.HTTP_409_CONFLICT, conflict.reason) from None


@router.get(
    "/teams",
    summary="List your teams",
    responses={status.HTTP_401_UNAUTHORIZED: {"description": NOT_SIGNED_IN}},
)
def list_teams(session: SessionDep, user: CurrentUser) -> list[Team]:
    """Your teams, most recently changed first, each with its Pokémon in slot order."""
    return service.list_teams(session, user.id)


@router.put(
    "/teams/{team_id}",
    summary="Create a team",
    responses={
        status.HTTP_201_CREATED: {"model": Team, "description": "The team was created."},
        status.HTTP_401_UNAUTHORIZED: {"description": NOT_SIGNED_IN},
        status.HTTP_409_CONFLICT: {
            "model": TeamConflict,
            "description": "The change can't be made to the team as it is now; `detail` says why.",
        },
    },
)
def create_team(
    session: SessionDep, user: CurrentUser, response: Response, team_id: TeamId, team: NewTeam
) -> Team:
    """Creates a team with the `id` you choose, a new UUID, and any Pokémon to start with.

    Sending the same `id` again returns the team it made, unchanged, with 200 instead of 201, so
    a create that's retried can't make two teams. An `id` someone else has is a 409, and a Pokémon
    `id` that no Pokémon has is a 422.
    """
    with team_errors():
        created_team, created = service.create_team(session, user.id, team_id, team)
    session.commit()
    if created:
        response.status_code = status.HTTP_201_CREATED
    return created_team


@router.get(
    "/teams/{team_id}",
    summary="Get a team",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": NOT_SIGNED_IN},
        status.HTTP_404_NOT_FOUND: {"description": TEAM_NOT_FOUND},
    },
)
def get_team(session: SessionDep, user: CurrentUser, team_id: TeamId) -> Team:
    """One of your teams, with its Pokémon in slot order."""
    with team_errors():
        return service.get_team(session, user.id, team_id)


@router.patch(
    "/teams/{team_id}",
    summary="Rename a team",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": NOT_SIGNED_IN},
        status.HTTP_404_NOT_FOUND: {"description": TEAM_NOT_FOUND},
    },
)
def rename_team(
    session: SessionDep, user: CurrentUser, team_id: TeamId, rename: TeamRename
) -> Team:
    """Gives one of your teams a new name."""
    with team_errors():
        renamed = service.rename_team(session, user.id, team_id, rename.name)
    session.commit()
    return renamed


@router.delete(
    "/teams/{team_id}",
    summary="Delete a team",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": NOT_SIGNED_IN},
        status.HTTP_404_NOT_FOUND: {"description": TEAM_NOT_FOUND},
    },
)
def delete_team(session: SessionDep, user: CurrentUser, team_id: TeamId) -> None:
    """Deletes one of your teams."""
    with team_errors():
        service.delete_team(session, user.id, team_id)
    session.commit()


@router.post(
    "/teams/{team_id}/members",
    summary="Add a Pokémon to a team",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": NOT_SIGNED_IN},
        status.HTTP_404_NOT_FOUND: {"description": TEAM_NOT_FOUND},
        status.HTTP_409_CONFLICT: {
            "model": TeamConflict,
            "description": "The change can't be made to the team as it is now; `detail` says why.",
        },
    },
)
def add_team_member(
    session: SessionDep, user: CurrentUser, team_id: TeamId, member: NewMember
) -> Team:
    """Puts a Pokémon in the team's next free slot. A team holds up to six, one of each species:
    Charizard and Mega Charizard X can't share one. An `id` with no Pokémon is a 422.
    """
    with team_errors():
        team = service.add_member(session, user.id, team_id, member.pokemon_id)
    session.commit()
    return team


@router.put(
    "/teams/{team_id}/members/{pokemon_id}",
    summary="Replace a Pokémon on a team",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": NOT_SIGNED_IN},
        status.HTTP_404_NOT_FOUND: {"description": f"{TEAM_NOT_FOUND} Or: {MEMBER_NOT_FOUND}"},
        status.HTTP_409_CONFLICT: {
            "model": TeamConflict,
            "description": "The change can't be made to the team as it is now; `detail` says why.",
        },
    },
)
def replace_team_member(
    session: SessionDep,
    user: CurrentUser,
    team_id: TeamId,
    pokemon_id: MemberId,
    member: NewMember,
) -> Team:
    """Puts another Pokémon in this member's slot, such as Charizard in Charmander's. If the new
    Pokémon is on the team already, it moves into the slot and the gap it leaves closes. An `id`
    with no Pokémon is a 422.
    """
    with team_errors():
        team = service.replace_member(session, user.id, team_id, pokemon_id, member.pokemon_id)
    session.commit()
    return team


@router.delete(
    "/teams/{team_id}/members/{pokemon_id}",
    summary="Remove a Pokémon from a team",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": NOT_SIGNED_IN},
        status.HTTP_404_NOT_FOUND: {"description": f"{TEAM_NOT_FOUND} Or: {MEMBER_NOT_FOUND}"},
    },
)
def remove_team_member(
    session: SessionDep, user: CurrentUser, team_id: TeamId, pokemon_id: MemberId
) -> Team:
    """Takes a Pokémon off the team; the members after it move up a slot."""
    with team_errors():
        team = service.remove_member(session, user.id, team_id, pokemon_id)
    session.commit()
    return team


@router.put(
    "/teams/{team_id}/order",
    summary="Reorder a team",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": NOT_SIGNED_IN},
        status.HTTP_404_NOT_FOUND: {"description": TEAM_NOT_FOUND},
        status.HTTP_409_CONFLICT: {
            "model": TeamConflict,
            "description": "The change can't be made to the team as it is now; `detail` says why.",
        },
    },
)
def reorder_team(session: SessionDep, user: CurrentUser, team_id: TeamId, order: TeamOrder) -> Team:
    """Puts the team's members in a new order. Give every member's Pokémon `id`, each once: if
    the team has changed since you read it, that's a 409 with `order_out_of_date`.
    """
    with team_errors():
        team = service.reorder(session, user.id, team_id, order.pokemon_ids)
    session.commit()
    return team
