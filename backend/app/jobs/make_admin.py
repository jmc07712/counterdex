"""Job: make a user an admin, or with --revoke take that away.

uv run --env-file ../.env python -m app.jobs.make_admin USERNAME [--revoke]
"""

import argparse
import logging
import sys
from collections.abc import Callable, Sequence

from sqlalchemy.orm import Session

from app.accounts.exceptions import UserNotFoundError
from app.accounts.service import set_admin
from app.core.db import get_engine

logger = logging.getLogger(__name__)


def main(argv: Sequence[str], sessions: Callable[[], Session]) -> int:
    """Run the job with these command-line arguments; return the process exit code.

    Running it again with the same arguments changes nothing more.
    """
    parser = argparse.ArgumentParser(
        prog="python -m app.jobs.make_admin", description="Make a user an admin, or take that away."
    )
    parser.add_argument("username", help="The user's username. Case doesn't matter.")
    parser.add_argument(
        "--revoke", action="store_true", help="Take admin away from the user instead."
    )
    arguments = parser.parse_args(argv)

    with sessions() as session:
        try:
            user = set_admin(session, arguments.username, not arguments.revoke)
        except UserNotFoundError:
            logger.error("No user has the username %s.", arguments.username)
            return 1
        session.commit()

    logger.info("%s is %s an admin", user.username, "no longer" if arguments.revoke else "now")
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    sys.exit(main(sys.argv[1:], lambda: Session(get_engine())))
