"""The OpenAPI tags that sort the docs' sidebar: one for each kind of thing the API serves."""

from typing import Any

POKEMON = "Pokémon"
SYNC = "Sync"
SESSION = "Session"
TEAMS = "Teams"
TEAM_MEMBERS = "Team members"
HEALTH = "Health"

# In sidebar order, each with the line the docs show under its name.
TAGS: list[dict[str, Any]] = [
    {
        "name": POKEMON,
        "description": "Every Pokémon PokéAPI lists, kept current by a sync. No sign-in needed.",
    },
    {
        "name": SYNC,
        "description": (
            "How current the Pokédex is: when the sync last ran and what it found. "
            "No sign-in needed."
        ),
    },
    {
        "name": SESSION,
        "description": (
            "Signing up, in and out. Signing in sets the session cookie needed to create or "
            "change a team."
        ),
    },
    {
        "name": TEAMS,
        "description": (
            "Teams of up to six Pokémon. Anyone can see them; creating one needs signing in, "
            "and changing one needs signing in as its owner."
        ),
    },
    {
        "name": TEAM_MEMBERS,
        "description": (
            "The Pokémon on one of your teams, in slot order. Every route needs signing in."
        ),
    },
    {"name": HEALTH, "description": "Whether the API is up."},
]

# Headings the docs show over the tags (Scalar reads OpenAPI's x-tagGroups extension).
TAG_GROUPS: list[dict[str, Any]] = [
    {"name": "Pokédex", "tags": [POKEMON, SYNC]},
    {"name": "Account", "tags": [SESSION]},
    {"name": "Teams", "tags": [TEAMS, TEAM_MEMBERS]},
    {"name": "Service", "tags": [HEALTH]},
]
