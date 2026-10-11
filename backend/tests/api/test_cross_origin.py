import pytest
from fastapi.testclient import TestClient

# The test client sends requests to https://testserver, so its Host header is "testserver".


@pytest.mark.parametrize(
    "headers",
    [
        pytest.param({"sec-fetch-site": "same-origin"}, id="same-origin"),
        pytest.param({"sec-fetch-site": "none"}, id="typed-into-the-address-bar"),
        pytest.param({"origin": "https://testserver"}, id="older-browser-same-origin"),
        pytest.param({}, id="not-a-browser"),
    ],
)
def test_lets_through_writes_from_this_site_or_outside_a_browser(
    ash_client: TestClient, headers: dict[str, str]
) -> None:
    assert ash_client.delete("/api/session", headers=headers).status_code == 204


@pytest.mark.parametrize(
    "headers",
    [
        pytest.param({"sec-fetch-site": "cross-site"}, id="cross-site"),
        pytest.param({"sec-fetch-site": "same-site"}, id="same-site-other-origin"),
        pytest.param(
            {"sec-fetch-site": "cross-site", "origin": "https://testserver"},
            id="sec-fetch-site-wins",
        ),
        pytest.param({"origin": "https://elsewhere.example"}, id="older-browser-cross-site"),
        pytest.param({"origin": "null"}, id="opaque-origin"),
    ],
)
def test_refuses_writes_a_browser_sends_from_another_origin(
    ash_client: TestClient, headers: dict[str, str]
) -> None:
    response = ash_client.delete("/api/session", headers=headers)

    assert response.status_code == 403
    assert response.json() == {"detail": "Requests from other sites can't make changes here."}
    # Still signed in: the request never reached the route.
    assert ash_client.get("/api/session").status_code == 200


def test_lets_through_reads_from_another_origin(client: TestClient) -> None:
    assert client.get("/api/health", headers={"sec-fetch-site": "cross-site"}).status_code == 200
