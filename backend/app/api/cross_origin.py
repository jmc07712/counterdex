"""Refuses changes a browser was made to send from another site (cross-site request forgery)."""

from urllib.parse import urlsplit

from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
CROSS_ORIGIN_REFUSED = "Cross-origin requests can't change anything."


class CrossOriginProtection:
    """ASGI middleware with the rules of Go's net/http CrossOriginProtection: a request other
    than GET, HEAD or OPTIONS gets a 403 if a browser says it came from another origin.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] == "http"
            and scope["method"] not in SAFE_METHODS
            and is_cross_origin(Headers(scope=scope))
        ):
            response = JSONResponse({"detail": CROSS_ORIGIN_REFUSED}, status_code=403)
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)


def is_cross_origin(headers: Headers) -> bool:
    fetch_site = headers.get("sec-fetch-site")
    if fetch_site is not None:
        # "none" is a request the user made directly, e.g. from a bookmark.
        return fetch_site not in {"same-origin", "none"}
    # Without Sec-Fetch-Site, an Origin header must name this host. Requests with neither header
    # are let through, as Go's are, so clients like curl work.
    origin = headers.get("origin")
    return origin is not None and urlsplit(origin).netloc != headers.get("host")
