class PokeApiError(Exception):
    """PokéAPI sent something we can't trust to be safe or complete."""


class SuspiciousRemovalError(Exception):
    """A sync would remove so many Pokémon that the listing is probably wrong."""


class SyncAlreadyRunningError(Exception):
    """Another sync holds the lock; this one would race it."""
