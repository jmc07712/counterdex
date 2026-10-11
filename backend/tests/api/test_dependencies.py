from fastapi import Response
from sqlalchemy.orm import Session

from app.accounts.types import SignedIn
from app.api.dependencies import require_user


def test_a_signed_in_users_responses_are_never_cached(db_session: Session, ash: SignedIn) -> None:
    # Wherever a route that needs signing in lives, its response is that user's alone.
    response = Response()

    assert require_user(db_session, response, ash.token) == ash.user
    assert response.headers["cache-control"] == "no-store"
