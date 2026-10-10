"""Print the API's OpenAPI schema, which the frontend generates its API client from.

uv run python -m app.api.export_openapi > ../frontend/openapi.json
"""

import json
import sys

from app.api.main import app


def main() -> None:
    json.dump(app.openapi(), sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
