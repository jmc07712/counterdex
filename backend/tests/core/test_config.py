import pytest

from app.core.config import Settings


@pytest.mark.parametrize(
    "url",
    ["postgres://user:pw@host:5432/db", "postgresql://user:pw@host:5432/db"],
)
def test_database_url_is_switched_to_the_psycopg_driver(
    monkeypatch: pytest.MonkeyPatch, url: str
) -> None:
    # Neon and Vercel hand out plain postgres:// URLs; SQLAlchemy needs the driver named.
    monkeypatch.setenv("DATABASE_URL", url)

    assert Settings().database_url == "postgresql+psycopg://user:pw@host:5432/db"


def test_database_url_that_names_a_driver_is_kept(monkeypatch: pytest.MonkeyPatch) -> None:
    url = "postgresql+psycopg://user:pw@host:5432/db"
    monkeypatch.setenv("DATABASE_URL", url)

    assert Settings().database_url == url


def test_refuses_to_start_without_a_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValueError, match="database_url"):
        Settings()
