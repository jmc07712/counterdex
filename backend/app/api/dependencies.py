from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.db import get_session

# A route that declares `session: SessionDep` gets one database session for the request.
SessionDep = Annotated[Session, Depends(get_session)]
