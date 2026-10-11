"""Tunables for the HTTP API."""

# --- Paths ---

# Vercel routes only /api/* to this service, so everything it serves lives there, docs included.
API_PREFIX = "/api"
DOCS_URL = f"{API_PREFIX}/docs"
OPENAPI_URL = f"{API_PREFIX}/openapi.json"

# --- Docs page ---

API_TITLE = "Counterdex API"
# The page runs this script, so it's pinned: a new Scalar release can't change the page unseen.
SCALAR_JS_URL = "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.72.1"

# --- Caching ---

# Pokémon only change when the sync runs (about daily). Browsers reuse a response for 5 minutes
# and Vercel's CDN for an hour; after that the CDN answers with its old copy (for up to a day)
# while it fetches a fresh one.
POKEMON_CACHE_CONTROL = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
# Sync status is small and read on every Pokédex visit: a minute in browsers, five at the CDN.
SYNC_STATUS_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=3600"
# A counter team is worked out from Pokédex data alone, so it changes only when a sync changes
# that data: it's kept as long as Pokémon are.
COUNTER_TEAM_CACHE_CONTROL = POKEMON_CACHE_CONTROL
