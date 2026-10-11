"""Caching headers for the API's responses."""

from fastapi import Response
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import get_settings


class NoStoreByDefault:
    """ASGI middleware: a response sent through it without Cache-Control gets `no-store`, so
    browsers and the CDN keep only the responses a route lets them keep with cache_publicly.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_cache_control(message: Message) -> None:
            if message["type"] == "http.response.start":
                message.setdefault("headers", [])
                MutableHeaders(scope=message).setdefault("Cache-Control", "no-store")
            await send(message)

        await self.app(scope, receive, send_with_cache_control)


def cache_publicly(response: Response, policy: str) -> None:
    """Lets browsers and the CDN keep the response as `policy` says, unless caching is off."""
    response.headers["Cache-Control"] = policy if get_settings().cache_responses else "no-store"
