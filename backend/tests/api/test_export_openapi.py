import json

import pytest

from app.api.export_openapi import main
from app.api.main import app


def test_prints_the_openapi_schema(capsys: pytest.CaptureFixture[str]) -> None:
    main()

    assert json.loads(capsys.readouterr().out) == app.openapi()


def test_the_frontends_copy_of_the_schema_is_current(pytestconfig: pytest.Config) -> None:
    # The frontend generates its typed API client from this file, so it must match the API.
    committed = pytestconfig.rootpath.parent / "frontend" / "openapi.json"

    assert json.loads(committed.read_text()) == app.openapi(), (
        "frontend/openapi.json is out of date: run `npm run api:generate` in frontend/"
    )
