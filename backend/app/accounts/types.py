from dataclasses import dataclass, field
from datetime import datetime

from app.accounts.schemas import User


@dataclass(frozen=True)
class SignedIn:
    """A signed-in session: who it's for, its cookie's token, and when it expires."""

    user: User
    # The database stores only its hash.
    token: str = field(repr=False)
    expires_at: datetime
