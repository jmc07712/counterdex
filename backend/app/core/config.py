from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """App configuration, read from environment variables.

    The app never reads .env itself: Vercel provides real environment variables, and locally
    `uv run --env-file .env ...` loads them (see .env.example).
    """

    database_url: str

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, url: str) -> str:
        # Neon and Vercel provide postgres:// URLs; SQLAlchemy needs the driver in the scheme.
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url.removeprefix(prefix)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
