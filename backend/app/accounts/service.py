"""Signing up, signing in and signing out.

Nothing here commits: the caller owns the transaction.
"""

from datetime import UTC, datetime

from psycopg.errors import UniqueViolation
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.accounts import models
from app.accounts.constants import RENEW_SESSIONS_WITHIN, SESSION_LIFETIME
from app.accounts.exceptions import UsernameTakenError
from app.accounts.passwords import hash_password, verify_password
from app.accounts.schemas import Credentials, User
from app.accounts.tokens import hash_token, new_token
from app.accounts.types import SignedIn


def sign_up(session: Session, credentials: Credentials) -> SignedIn:
    """Creates an account and signs it in.

    Raises UsernameTakenError if someone has the username, whatever its case.
    """
    user = models.User(
        username=credentials.username,
        password_hash=hash_password(credentials.password.get_secret_value()),
    )
    try:
        # In a savepoint, so a taken username doesn't abort the caller's transaction.
        with session.begin_nested():
            session.add(user)
    except IntegrityError as error:
        if _violates(error, models.USERNAME_INDEX.name):
            raise UsernameTakenError(credentials.username) from error
        raise
    return _start_session(session, user)


def sign_in(session: Session, credentials: Credentials) -> SignedIn | None:
    """Starts a session if the password is right, or returns None.

    A wrong username and a wrong password return the same thing.
    """
    password = credentials.password.get_secret_value()
    user = session.scalars(
        select(models.User).where(func.lower(models.User.username) == credentials.username.lower())
    ).one_or_none()
    if user is None:
        verify_password(password, None)
        return None
    if not verify_password(password, user.password_hash):
        return None

    # Expired sessions aren't deleted anywhere else.
    session.execute(
        delete(models.UserSession).where(
            models.UserSession.user_id == user.id,
            models.UserSession.expires_at <= datetime.now(UTC),
        )
    )
    return _start_session(session, user)


def find_signed_in(session: Session, token: str) -> SignedIn | None:
    """Who `token` signs in, or None if it isn't a current session's.

    A session used in the second half of its life is renewed for a full one.
    """
    now = datetime.now(UTC)
    row = session.execute(
        select(models.UserSession, models.User)
        .join(models.User)
        .where(
            models.UserSession.token_hash == hash_token(token),
            models.UserSession.expires_at > now,
        )
    ).one_or_none()
    if row is None:
        return None

    user_session, user = row
    if user_session.expires_at - now < RENEW_SESSIONS_WITHIN:
        user_session.expires_at = now + SESSION_LIFETIME
        session.flush()
    return SignedIn(User.model_validate(user), token, user_session.expires_at)


def sign_out(session: Session, token: str) -> None:
    """Ends the session `token` signs in, if there is one. The user's other sessions go on."""
    session.execute(
        delete(models.UserSession).where(models.UserSession.token_hash == hash_token(token))
    )


def _start_session(session: Session, user: models.User) -> SignedIn:
    token = new_token()
    expires_at = datetime.now(UTC) + SESSION_LIFETIME
    session.add(
        models.UserSession(token_hash=hash_token(token), user_id=user.id, expires_at=expires_at)
    )
    session.flush()
    return SignedIn(User.model_validate(user), token, expires_at)


def _violates(error: IntegrityError, constraint: str | None) -> bool:
    return isinstance(error.orig, UniqueViolation) and error.orig.diag.constraint_name == constraint
