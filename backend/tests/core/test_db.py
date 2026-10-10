from sqlalchemy import text

from app.core.db import get_engine


def test_engine_connects_to_the_test_database() -> None:
    with get_engine().connect() as connection:
        database = connection.execute(text("select current_database()")).scalar_one()

    assert database == "counterdex_test"
