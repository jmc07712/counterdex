"""How the API reports errors."""

from fastapi import HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


async def validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
    """FastAPI's 422 response, less each error's `input`, which can be a password."""
    errors = [
        {key: value for key, value in each.items() if key != "input"} for each in error.errors()
    ]
    return JSONResponse({"detail": jsonable_encoder(errors)}, status_code=422)


class ConflictError(HTTPException):
    """A 409 that says what's wrong in a sentence (`detail`) and as a code programs can act on
    (`reason`).
    """

    def __init__(self, detail: str, reason: str) -> None:
        super().__init__(status.HTTP_409_CONFLICT, detail)
        self.reason = reason


async def conflict(request: Request, error: ConflictError) -> JSONResponse:
    return JSONResponse(
        {"detail": error.detail, "reason": error.reason}, status_code=error.status_code
    )
