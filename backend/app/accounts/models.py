from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    LargeBinary,
    Text,
    false,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.accounts.constants import USERNAME_PATTERN
from app.core.db import Base


class User(Base):
    """Someone who has signed up."""

    __tablename__ = "users"
    __table_args__ = (CheckConstraint(f"username ~ '{USERNAME_PATTERN}'", name="valid_username"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    username: Mapped[str] = mapped_column(Text)
    # An argon2id hash.
    password_hash: Mapped[str] = mapped_column(Text)
    is_admin: Mapped[bool] = mapped_column(server_default=false())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# Unique ignoring case: "Ash" and "ash" are one user. Sign-in looks usernames up with it too.
USERNAME_INDEX = Index("uq_users_lower_username", func.lower(User.username), unique=True)


class UserSession(Base):
    """A signed-in browser. Its cookie holds a random token; only the token's hash is stored."""

    __tablename__ = "user_sessions"

    token_hash: Mapped[bytes] = mapped_column(LargeBinary, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
