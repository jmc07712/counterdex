"""A guard for jobs that make up data: they run only against a database on this machine."""

from sqlalchemy.engine import make_url

from app.core.config import get_settings

LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})


def is_local_database() -> bool:
    """Whether DATABASE_URL points at this machine, such as docker-compose.yml's Postgres."""
    return make_url(get_settings().database_url).host in LOCAL_HOSTS
