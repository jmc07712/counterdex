import pytest

from app.core.config import Settings


@pytest.mark.parametrize(
    "url",
    ["postgres://user:pw@host:5432/db", "postgresql://user:pw@host:5432/db"],
)
def test_database_url_is_switched_to_the_psycopg_driver(url: str) -> None:
    # Neon and Vercel hand out plain postgres:// URLs; SQLAlchemy needs the driver named.
    settings = Settings(database_url=url)

    assert settings.database_url == "postgresql+psycopg://user:pw@host:5432/db"


def test_database_url_that_names_a_driver_is_kept() -> None:
    url = "postgresql+psycopg://user:pw@host:5432/db"

    assert Settings(database_url=url).database_url == url
