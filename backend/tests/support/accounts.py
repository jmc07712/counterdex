from datetime import UTC, datetime, timedelta

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.accounts.models import UserSession
from app.accounts.schemas import NewAccount
from app.accounts.tokens import hash_token

ASH = NewAccount(username="ash", password="pikachu-i-choose-you")


def expire_in(session: Session, token: str, time_left: timedelta) -> None:
    """Makes the session `token` signs in to expire `time_left` from now, as if time had passed."""
    session.execute(
        update(UserSession)
        .where(UserSession.token_hash == hash_token(token))
        .values(expires_at=datetime.now(UTC) + time_left)
    )
