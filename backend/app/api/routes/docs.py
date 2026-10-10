from fastapi import APIRouter
from fastapi.responses import HTMLResponse, RedirectResponse
from scalar_fastapi import AgentScalarConfig, get_scalar_api_reference

from app.api.constants import API_PREFIX, API_TITLE, DOCS_URL, OPENAPI_URL, SCALAR_JS_URL

# Paths are absolute: they're the API's own address and its docs, defined in constants.
router = APIRouter()


# Both spellings are handled here: Starlette's own trailing-slash redirect would send an absolute
# URL built from the server's address, which behind a proxy isn't the one the browser used.
@router.get(API_PREFIX, include_in_schema=False)
@router.get(f"{API_PREFIX}/", include_in_schema=False)
def open_docs() -> RedirectResponse:
    """The API's own address opens its interactive docs."""
    return RedirectResponse(DOCS_URL)


@router.get(DOCS_URL, include_in_schema=False)
def docs() -> HTMLResponse:
    """Interactive docs (Scalar), which show each model by name, unlike Swagger UI's."""
    return get_scalar_api_reference(
        openapi_url=OPENAPI_URL,
        title=API_TITLE,
        scalar_js_url=SCALAR_JS_URL,
        # Nothing on the page reports back to Scalar or offers its AI agent.
        telemetry=False,
        agent=AgentScalarConfig(disabled=True),
    )
