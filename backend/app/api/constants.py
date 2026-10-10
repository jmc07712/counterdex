"""Tunables for the HTTP API."""

# --- Pagination ---

DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200
# Cursors are Pokémon ids, which Postgres stores as 32-bit integers; anything larger can't match
# a row and would fail in the database instead of being rejected as bad input.
MAX_CURSOR = 2**31 - 1

# --- Caching ---

# Pokémon only change when the sync runs (about daily). Browsers reuse a response for 5 minutes
# and Vercel's CDN for an hour; after that the CDN answers with its old copy (for up to a day)
# while it fetches a fresh one.
POKEMON_CACHE_CONTROL = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
