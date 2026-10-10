"""Tunables for syncing with PokéAPI."""

# --- PokéAPI client ---

POKEAPI_BASE_URL = "https://pokeapi.co/api/v2/"
# PokéAPI's fair-use policy asks clients to identify themselves.
USER_AGENT = "counterdex-sync (+https://github.com/jmc07712/counterdex)"
REQUEST_TIMEOUT_SECONDS = 15
# Entries per listing page; PokéAPI paginates and returns a `next` link until the last page.
PAGE_SIZE = 200
# A listing that runs past this (20,000 Pokémon) is broken, not big.
MAX_PAGES = 100
CONCURRENT_REQUESTS = 20
MAX_ATTEMPTS = 3
# Doubles after each failed attempt: 0.5s, 1s, 2s, ...
RETRY_DELAY_SECONDS = 0.5
# Rate limiting and server-side failures are worth retrying; other errors won't fix themselves.
RETRYABLE_STATUS_CODES = frozenset({429, 500, 502, 503, 504})

# What PokéAPI calls each of our stats; every PokéAPI Pokémon must have all six.
POKEAPI_STAT_NAMES = {
    "hp": "hp",
    "attack": "attack",
    "defense": "defense",
    "sp_attack": "special-attack",
    "sp_defense": "special-defense",
    "speed": "speed",
}

# --- Storing a sync ---

# Removing more than this in one sync is far likelier to be a broken listing than a real change.
MAX_REMOVED_SHARE = 0.05
MIN_REMOVALS_ALLOWED = 10
# Postgres advisory lock that lets only one sync write at a time (any constant works).
SYNC_LOCK_KEY = 4_202_510
