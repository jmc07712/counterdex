"""Constants for accounts and their sign-in sessions."""

from datetime import timedelta

# --- Usernames ---

MIN_USERNAME_LENGTH = 3
MAX_USERNAME_LENGTH = 32
# Checked by Pydantic's regex engine and by the users table in Postgres, which read this pattern
# the same way. Python's re would not: its $ also matches before a final newline.
USERNAME_PATTERN = f"^[A-Za-z0-9_-]{{{MIN_USERNAME_LENGTH},{MAX_USERNAME_LENGTH}}}$"

# --- Passwords ---

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128

# --- Sessions ---

SESSION_LIFETIME = timedelta(days=30)
# A session used with less than this left is renewed for another SESSION_LIFETIME.
RENEW_SESSIONS_WITHIN = SESSION_LIFETIME / 2
