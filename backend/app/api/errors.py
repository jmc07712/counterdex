"""How the API reports errors."""

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


async def validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
    """FastAPI's 422 response, less each error's `input`, which can be a password."""
    errors = [
        {key: value for key, value in each.items() if key != "input"} for each in error.errors()
    ]
    return JSONResponse({"detail": jsonable_encoder(errors)}, status_code=422)
