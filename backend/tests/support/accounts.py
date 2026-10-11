from dataclasses import replace
from datetime import UTC, datetime, timedelta

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.accounts import service
from app.accounts.models import User, UserSession
from app.accounts.schemas import NewAccount
from app.accounts.tokens import hash_token
from app.accounts.types import SignedIn

ASH = NewAccount(username="ash", password="pikachu-i-choose-you")

# A second user, for checking one user can't see or change another's things.
MISTY = NewAccount(username="misty", password="starmie-and-staryu")

# A third user, whose username has a capital letter.
BROCK = NewAccount(username="Brock", password="onix-and-geodude")

# A fourth user, for the routes only admins can use: see sign_up_admin.
OAK = NewAccount(username="oak", password="professor-of-pokemon")


def sign_up_admin(session: Session, account: NewAccount) -> SignedIn:
    """Creates an account that is an admin and signs it in."""
    signed_in = service.sign_up(session, account)
    session.execute(update(User).where(User.id == signed_in.user.id).values(is_admin=True))
    return replace(signed_in, user=signed_in.user.model_copy(update={"is_admin": True}))


def expire_in(session: Session, token: str, time_left: timedelta) -> None:
    """Makes the session `token` signs in to expire `time_left` from now, as if time had passed."""
    session.execute(
        update(UserSession)
        .where(UserSession.token_hash == hash_token(token))
        .values(expires_at=datetime.now(UTC) + time_left)
    )
