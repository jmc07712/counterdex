from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.accounts import service
from app.accounts.exceptions import UsernameTakenError
from app.accounts.schemas import Credentials, NewAccount, User
from app.api.caching import never_cache
from app.api.dependencies import NOT_SIGNED_IN, CurrentUser, SessionDep
from app.api.session_cookie import clear_session_cookie, read_session_cookie, set_session_cookie

router = APIRouter(dependencies=[Depends(never_cache)])

USERNAME_TAKEN = "Someone already has this username."
WRONG_CREDENTIALS = "Wrong username or password."


@router.post(
    "/users",
    summary="Sign up",
    status_code=status.HTTP_201_CREATED,
    responses={status.HTTP_409_CONFLICT: {"description": USERNAME_TAKEN}},
)
def sign_up(session: SessionDep, response: Response, account: NewAccount) -> User:
    """Creates an account and signs in to it: the response sets the session cookie."""
    try:
        signed_in = service.sign_up(session, account)
    except UsernameTakenError:
        raise HTTPException(status.HTTP_409_CONFLICT, USERNAME_TAKEN) from None
    session.commit()
    set_session_cookie(response, signed_in)
    return signed_in.user


@router.post(
    "/session",
    summary="Sign in",
    responses={status.HTTP_401_UNAUTHORIZED: {"description": WRONG_CREDENTIALS}},
)
def sign_in(session: SessionDep, response: Response, credentials: Credentials) -> User:
    """Starts a session: the response sets the session cookie, which later requests send back.

    Sessions last 30 days, and using one in its last 15 renews it for another 30.
    """
    signed_in = service.sign_in(session, credentials)
    if signed_in is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, WRONG_CREDENTIALS)
    session.commit()
    set_session_cookie(response, signed_in)
    return signed_in.user


@router.get(
    "/session",
    summary="Get the signed-in user",
    responses={status.HTTP_401_UNAUTHORIZED: {"description": NOT_SIGNED_IN}},
)
def get_current_user(user: CurrentUser) -> User:
    """Who the session cookie signs in."""
    return user


@router.delete("/session", summary="Sign out", status_code=status.HTTP_204_NO_CONTENT)
def sign_out(session: SessionDep, request: Request, response: Response) -> None:
    """Ends the session and clears its cookie. Signing out when signed out does nothing."""
    token = read_session_cookie(request)
    if token is not None:
        service.sign_out(session, token)
        session.commit()
    clear_session_cookie(response)
