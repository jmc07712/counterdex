"""The cookie that keeps a browser signed in."""

from datetime import UTC

from fastapi import Request, Response

from app.accounts.types import SignedIn
from app.core.config import get_settings


def session_cookie_name() -> str:
    # Browsers accept a __Host- cookie only if it's Secure, has no Domain and has Path=/.
    return "__Host-session" if get_settings().secure_cookies else "session"


def read_session_cookie(request: Request) -> str | None:
    return request.cookies.get(session_cookie_name())


def set_session_cookie(response: Response, signed_in: SignedIn) -> None:
    response.set_cookie(
        session_cookie_name(),
        signed_in.token,
        # Starlette formats `expires` only from a datetime in UTC.
        expires=signed_in.expires_at.astimezone(UTC),
        path="/",
        secure=get_settings().secure_cookies,
        httponly=True,
        samesite="strict",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        session_cookie_name(),
        path="/",
        secure=get_settings().secure_cookies,
        httponly=True,
        samesite="strict",
    )
