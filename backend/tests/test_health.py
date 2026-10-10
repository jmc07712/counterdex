from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_ok():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_openapi_schema_is_served_under_api_prefix():
    # Vercel routes only /api/* to this service, so docs must live there too.
    response = client.get("/api/openapi.json")

    assert response.status_code == 200
    assert response.json()["info"]["title"] == "Counterdex API"


def test_docs_are_not_served_at_the_root():
    # Anything outside /api belongs to the frontend, so FastAPI must not claim these paths.
    assert client.get("/api/docs").status_code == 200
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404
