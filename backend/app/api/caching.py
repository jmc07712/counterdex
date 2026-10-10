"""Caching headers for the API's responses."""

from fastapi import Response

from app.core.config import get_settings


def cache_publicly(response: Response, policy: str) -> None:
    """Lets browsers and the CDN keep the response as `policy` says, unless caching is off."""
    response.headers["Cache-Control"] = policy if get_settings().cache_responses else "no-store"


def never_cache(response: Response) -> None:
    """FastAPI dependency: browsers and the CDN mustn't keep the response, e.g. as it depends on
    who's signed in.
    """
    response.headers["Cache-Control"] = "no-store"
