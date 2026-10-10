from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """App configuration, read from environment variables.

    The app never reads .env itself: Vercel provides real environment variables, and locally
    `vercel dev` or `uv run --env-file ../.env ...` loads them (see .env.example at the repo root).
    """

    # Read from the environment only, never passed in code (init=False tells type checkers).
    database_url: str = Field(init=False)
    # Neon's direct URL, set alongside database_url, which goes through its PgBouncer pooler.
    database_url_unpooled: str | None = Field(default=None, init=False)
    # Lets browsers and the CDN keep public responses. Off locally, where data changes by hand
    # and a kept response would hide the change.
    cache_responses: bool = Field(default=True, init=False)
    # Marks the session cookie Secure. Off locally: over plain http://localhost, Chrome and Safari
    # refuse a Secure cookie with a __Host- name.
    secure_cookies: bool = Field(default=True, init=False)

    @field_validator("database_url", "database_url_unpooled")
    @classmethod
    def use_psycopg_driver(cls, url: str | None) -> str | None:
        # Neon and Vercel provide postgres:// URLs; SQLAlchemy needs the driver in the scheme.
        for prefix in ("postgres://", "postgresql://"):
            if url is not None and url.startswith(prefix):
                return "postgresql+psycopg://" + url.removeprefix(prefix)
        return url

    @property
    def migration_database_url(self) -> str:
        """Migrations skip the pooler when there is one: schema changes need a real session."""
        return self.database_url_unpooled or self.database_url


@lru_cache
def get_settings() -> Settings:
    return Settings()
