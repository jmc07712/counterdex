from sqlalchemy import Engine, text

from app.core.db import get_engine


def test_engine_connects_to_the_test_run_database(
    postgres_url: str, migrated_engine: Engine
) -> None:
    assert get_engine().url.render_as_string(hide_password=False) == postgres_url

    with get_engine().connect() as connection:
        version = connection.execute(text("show server_version")).scalar_one()

    assert version.startswith("17.")
