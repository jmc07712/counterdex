from typing import Annotated

from fastapi import Depends, HTTPException, Response, Security, status
from sqlalchemy.orm import Session

from app.accounts import service
from app.accounts.schemas import User
from app.api.caching import never_cache
from app.api.session_cookie import session_cookie, set_session_cookie
from app.core.db import get_session

# A route that declares `session: SessionDep` gets one database session for the request.
SessionDep = Annotated[Session, Depends(get_session)]

NOT_SIGNED_IN = (
    "Sign in first: POST /api/session with your username and password sets the session cookie."
)


def require_user(
    session: SessionDep,
    response: Response,
    token: Annotated[str | None, Security(session_cookie)],
) -> User:
    """FastAPI dependency: the user the session cookie signs in, or a 401.

    Through the SessionCookie scheme, so the API's docs mark every route that uses it. The
    cookie is set again each time, so its expiry follows the session's when it's renewed. The
    response is the user's alone, so it's never cached.
    """
    signed_in = service.find_signed_in(session, token) if token is not None else None
    if signed_in is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, NOT_SIGNED_IN)
    session.commit()
    never_cache(response)
    set_session_cookie(response, signed_in)
    return signed_in.user


# A route that declares `user: CurrentUser` is for signed-in users only.
CurrentUser = Annotated[User, Depends(require_user)]
