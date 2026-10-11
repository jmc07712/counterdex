class UsernameTakenError(Exception):
    """Someone already has this username, in some combination of upper and lower case."""


class UserNotFoundError(Exception):
    """No user has this username, in any combination of upper and lower case."""
