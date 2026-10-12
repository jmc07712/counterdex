import pytest

from app.core.config import Settings


@pytest.mark.parametrize(
    "url",
    [
        "postgres://user:pw@host:5432/db",
        "postgresql://user:pw@host:5432/db",
        "postgresql+psycopg://user:pw@host:5432/db",
    ],
)
def test_database_url_uses_the_psycopg_driver(monkeypatch: pytest.MonkeyPatch, url: str) -> None:
    # Neon and Vercel hand out plain postgres:// URLs; SQLAlchemy needs the driver named.
    monkeypatch.setenv("DATABASE_URL", url)

    assert Settings().database_url == "postgresql+psycopg://user:pw@host:5432/db"


def test_refuses_to_start_without_a_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValueError, match="database_url"):
        Settings()


@pytest.mark.parametrize(
    ("direct_url", "host"),
    [
        pytest.param("postgresql://user:pw@direct-host/db", "direct-host", id="direct-url"),
        pytest.param(None, "pooled-host", id="no-direct-url"),
    ],
)
def test_migrations_use_the_direct_url_when_there_is_one(
    monkeypatch: pytest.MonkeyPatch, direct_url: str | None, host: str
) -> None:
    # Neon's pooled URL goes through PgBouncer, which migrations shouldn't.
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pw@pooled-host/db")
    if direct_url is None:
        monkeypatch.delenv("DATABASE_URL_UNPOOLED", raising=False)
    else:
        monkeypatch.setenv("DATABASE_URL_UNPOOLED", direct_url)

    assert Settings().migration_database_url == f"postgresql+psycopg://user:pw@{host}/db"
