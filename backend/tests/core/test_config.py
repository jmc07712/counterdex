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


def test_migrations_use_the_direct_url_when_there_is_one(monkeypatch: pytest.MonkeyPatch) -> None:
    # Neon's pooled URL goes through PgBouncer, which migrations shouldn't.
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pw@pooled-host/db")
    monkeypatch.setenv("DATABASE_URL_UNPOOLED", "postgresql://user:pw@direct-host/db")

    assert Settings().migration_database_url == "postgresql+psycopg://user:pw@direct-host/db"


def test_migrations_use_the_app_url_when_there_is_no_direct_one(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pw@localhost/db")
    monkeypatch.delenv("DATABASE_URL_UNPOOLED", raising=False)

    assert Settings().migration_database_url == "postgresql+psycopg://user:pw@localhost/db"
