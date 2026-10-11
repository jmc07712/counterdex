class UnknownPokemonError(Exception):
    """No Pokémon has one or more of the team's ids."""


class TypeChartMissingError(Exception):
    """No sync has stored the type chart yet, so no matchup can be worked out."""


class TooFewCandidatesError(Exception):
    """There are fewer evolution families to choose from than the team has Pokémon."""
