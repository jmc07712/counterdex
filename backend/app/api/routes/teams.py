import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status

from app.accounts.constants import USERNAME_PATTERN
from app.api.dependencies import NOT_SIGNED_IN, CurrentUser, SessionDep
from app.api.errors import ConflictError
from app.api.tags import TEAM_MEMBERS, TEAMS
from app.pokemon.constants import MAX_POKEMON_ID
from app.teams import models, service
from app.teams.enums import TeamConflictReason
from app.teams.exceptions import (
    MemberNotFoundError,
    NotTeamOwnerError,
    TeamConflictError,
    TeamNotFoundError,
    UnknownPokemonError,
    UserNotFoundError,
)
from app.teams.schemas import (
    NewMember,
    NewTeam,
    Team,
    TeamConflict,
    TeamMember,
    TeamOrder,
    TeamPage,
    TeamPreviewQuery,
    TeamRename,
    TeamsQuery,
)

router = APIRouter(tags=[TEAMS])
# The member routes get their own router: a route's tags add to its router's, not replace them.
members_router = APIRouter(tags=[TEAM_MEMBERS])

TEAM_NOT_FOUND = "No team has this id."
NOT_TEAM_OWNER = "Only the team's owner can change it."
USER_NOT_FOUND = "No user has this username."
MEMBER_NOT_FOUND = "That Pokémon isn't on the team."
UNKNOWN_POKEMON = "No Pokémon has this id, or a sync hasn't stored its species yet."
TEAM_CONFLICT = (
    "The change can't be made to the team as it is now: `detail` says why, and `reason` gives it "
    "as a code."
)

TeamId = Annotated[uuid.UUID, Path(description="The team's `id`: a UUID its creator chose.")]
MemberId = Annotated[
    int, Path(ge=1, le=MAX_POKEMON_ID, description="The member's Pokémon `id`, e.g. 6.")
]
Username = Annotated[
    str,
    Path(pattern=USERNAME_PATTERN, description="The user's `username`. Case doesn't matter."),
]


def conflict_detail(reason: TeamConflictReason) -> str:
    """A conflict's reason as a sentence, for people reading the API's responses."""
    match reason:
        case TeamConflictReason.TEAM_FULL:
            return "The team already has six Pokémon. Remove one first."
        case TeamConflictReason.FAMILY_ON_TEAM:
            return (
                "A team can have one Pokémon from each evolution family. Choose one from another "
                "family, or take out the one from this family."
            )
        case TeamConflictReason.ORDER_OUT_OF_DATE:
            return (
                "The order must list every Pokémon on the team, each once. Get the team again: "
                "it may have changed."
            )
        case TeamConflictReason.POKEMON_REMOVED:
            return "PokéAPI no longer lists this Pokémon, so it can't join a team."
        case TeamConflictReason.TEAM_ID_TAKEN:
            return "Another team already has this id. Choose a new UUID."


def require_team_owner(session: SessionDep, user: CurrentUser, team_id: TeamId) -> models.Team:
    """FastAPI dependency: the team in the path if the signed-in user owns it, or a 404 or 403.

    Its row stays locked until the request's transaction ends, so other changes to the team wait
    for the route's.
    """
    try:
        return service.lock_owned_team(session, user.id, team_id)
    except TeamNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, TEAM_NOT_FOUND) from None
    except NotTeamOwnerError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, NOT_TEAM_OWNER) from None


@contextmanager
def team_errors() -> Iterator[None]:
    """Turns the teams service's errors into the HTTP errors the routes document."""
    try:
        yield
    except TeamNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, TEAM_NOT_FOUND) from None
    except UserNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, USER_NOT_FOUND) from None
    except MemberNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, MEMBER_NOT_FOUND) from None
    except UnknownPokemonError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, UNKNOWN_POKEMON) from None
    except TeamConflictError as conflict:
        raise ConflictError(conflict_detail(conflict.reason), conflict.reason) from None


@router.get("/teams", summary="List everyone's teams")
def list_teams(session: SessionDep, query: Annotated[TeamsQuery, Query()]) -> TeamPage:
    """Everyone's teams that have at least one Pokémon, newest first, one page at a time, each
    with its owner and its Pokémon in slot order. The list can be filtered by search, type,
    recent changes and owner; with an `owner`, teams with no Pokémon are listed too.

    To get the next page, pass the response's `next_cursor` as `cursor`, keeping the same
    filters; it's `null` on the last page.
    """
    return service.list_teams(session, query)


@router.get(
    "/users/{username}/teams",
    summary="List a user's teams",
    responses={status.HTTP_404_NOT_FOUND: {"description": USER_NOT_FOUND}},
)
def list_user_teams(session: SessionDep, username: Username) -> list[Team]:
    """The user's teams, most recently changed first, each with its Pokémon in slot order.
    Teams with no Pokémon yet are listed too.
    """
    with team_errors():
        return service.list_user_teams(session, username)


@router.put(
    "/teams/{team_id}",
    summary="Create a team",
    responses={
        status.HTTP_201_CREATED: {"model": Team, "description": "The team was created."},
        status.HTTP_401_UNAUTHORIZED: {"description": NOT_SIGNED_IN},
        status.HTTP_409_CONFLICT: {
            "model": TeamConflict,
            "description": TEAM_CONFLICT,
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


# Before /teams/{team_id}, which would otherwise take "preview" for a team's id.
@router.get("/teams/preview", summary="Preview a team")
def preview_team(
    session: SessionDep, query: Annotated[TeamPreviewQuery, Query()]
) -> list[TeamMember]:
    """Pokémon as a team's members would be, in the order given, without saving a team or
    signing in: for a team that's kept in a guest's browser. Ids with no Pokémon are left out.
    """
    return service.preview(session, query.pokemon_ids)


@router.get(
    "/teams/{team_id}",
    summary="Get a team",
    responses={status.HTTP_404_NOT_FOUND: {"description": TEAM_NOT_FOUND}},
)
def get_team(session: SessionDep, team_id: TeamId) -> Team:
    """A team, with its owner and its Pokémon in slot order."""
    with team_errors():
        return service.get_team(session, team_id)


@router.patch(
    "/teams/{team_id}",
    summary="Rename a team",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": NOT_SIGNED_IN},
        status.HTTP_403_FORBIDDEN: {"description": NOT_TEAM_OWNER},
        status.HTTP_404_NOT_FOUND: {"description": TEAM_NOT_FOUND},
    },
)
def rename_team(
    session: SessionDep,
    team: Annotated[models.Team, Depends(require_team_owner)],
    rename: TeamRename,
) -> Team:
    """Gives one of your teams a new name."""
    renamed = service.rename_team(session, team, rename.name)
    session.commit()
    return renamed


@router.delete(
    "/teams/{team_id}",
    summary="Delete a team",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": NOT_SIGNED_IN},
        status.HTTP_403_FORBIDDEN: {"description": NOT_TEAM_OWNER},
        status.HTTP_404_NOT_FOUND: {"description": TEAM_NOT_FOUND},
    },
)
def delete_team(
    session: SessionDep, team: Annotated[models.Team, Depends(require_team_owner)]
) -> None:
    """Deletes one of your teams."""
    service.delete_team(session, team)
    session.commit()


@members_router.post(
    "/teams/{team_id}/members",
    summary="Add a Pokémon to a team",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": NOT_SIGNED_IN},
        status.HTTP_403_FORBIDDEN: {"description": NOT_TEAM_OWNER},
        status.HTTP_404_NOT_FOUND: {"description": TEAM_NOT_FOUND},
        status.HTTP_409_CONFLICT: {
            "model": TeamConflict,
            "description": TEAM_CONFLICT,
        },
    },
)
def add_team_member(
    session: SessionDep,
    team: Annotated[models.Team, Depends(require_team_owner)],
    member: NewMember,
) -> Team:
    """Puts a Pokémon in the team's next free slot. A team holds up to six, one from each
    evolution family: Charmander, Charizard and Mega Charizard X can't share one. An `id` with no
    Pokémon is a 422.
    """
    with team_errors():
        added = service.add_member(session, team, member.pokemon_id)
    session.commit()
    return added


@members_router.put(
    "/teams/{team_id}/members/{pokemon_id}",
    summary="Replace a Pokémon on a team",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": NOT_SIGNED_IN},
        status.HTTP_403_FORBIDDEN: {"description": NOT_TEAM_OWNER},
        status.HTTP_404_NOT_FOUND: {"description": f"{TEAM_NOT_FOUND} Or: {MEMBER_NOT_FOUND}"},
        status.HTTP_409_CONFLICT: {
            "model": TeamConflict,
            "description": TEAM_CONFLICT,
        },
    },
)
def replace_team_member(
    session: SessionDep,
    team: Annotated[models.Team, Depends(require_team_owner)],
    pokemon_id: MemberId,
    member: NewMember,
) -> Team:
    """Puts another Pokémon in this member's slot, such as Charizard in Charmander's. If the new
    Pokémon is on the team already, it moves into the slot and the gap it leaves closes. An `id`
    with no Pokémon is a 422.
    """
    with team_errors():
        replaced = service.replace_member(session, team, pokemon_id, member.pokemon_id)
    session.commit()
    return replaced


@members_router.delete(
    "/teams/{team_id}/members/{pokemon_id}",
    summary="Remove a Pokémon from a team",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": NOT_SIGNED_IN},
        status.HTTP_403_FORBIDDEN: {"description": NOT_TEAM_OWNER},
        status.HTTP_404_NOT_FOUND: {"description": f"{TEAM_NOT_FOUND} Or: {MEMBER_NOT_FOUND}"},
    },
)
def remove_team_member(
    session: SessionDep,
    team: Annotated[models.Team, Depends(require_team_owner)],
    pokemon_id: MemberId,
) -> Team:
    """Takes a Pokémon off the team; the members after it move up a slot."""
    with team_errors():
        removed = service.remove_member(session, team, pokemon_id)
    session.commit()
    return removed


@members_router.put(
    "/teams/{team_id}/order",
    summary="Reorder a team",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": NOT_SIGNED_IN},
        status.HTTP_403_FORBIDDEN: {"description": NOT_TEAM_OWNER},
        status.HTTP_404_NOT_FOUND: {"description": TEAM_NOT_FOUND},
        status.HTTP_409_CONFLICT: {
            "model": TeamConflict,
            "description": TEAM_CONFLICT,
        },
    },
)
def reorder_team(
    session: SessionDep, team: Annotated[models.Team, Depends(require_team_owner)], order: TeamOrder
) -> Team:
    """Puts the team's members in a new order. Give every member's Pokémon `id`, each once: if
    the team has changed since you read it, that's a 409 whose `reason` is `order_out_of_date`.
    """
    with team_errors():
        reordered = service.reorder(session, team, order.pokemon_ids)
    session.commit()
    return reordered
