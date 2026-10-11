"""The cookie that keeps a browser signed in."""

from datetime import UTC

from fastapi import Request, Response
from fastapi.security import APIKeyCookie

from app.accounts.types import SignedIn
from app.core.config import get_settings


def session_cookie_name() -> str:
    # Browsers accept a __Host- cookie only if it's Secure, has no Domain and has Path=/.
    return "__Host-session" if get_settings().secure_cookies else "session"


def read_session_cookie(request: Request) -> str | None:
    return request.cookies.get(session_cookie_name())


class SessionCookie(APIKeyCookie):
    """The session cookie as a security scheme, so the API's docs mark the routes that need
    signing in. The cookie's name depends on the settings, so it's read when a request comes in,
    not fixed when the app starts.
    """

    async def __call__(self, request: Request) -> str | None:
        return read_session_cookie(request)


session_cookie = SessionCookie(
    # Its name in production; see the description.
    name="__Host-session",
    scheme_name="SessionCookie",
    description="Set by signing in (`POST /api/session`) or up (`POST /api/users`). Running "
    "locally over HTTP, it's named `session`, as browsers keep `__Host-` cookies only over HTTPS.",
    auto_error=False,
)


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
