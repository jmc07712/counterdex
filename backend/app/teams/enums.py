from enum import StrEnum


class TeamConflictReason(StrEnum):
    """Why a change can't be made to a team as it is now."""

    TEAM_FULL = "team_full"
    SPECIES_ON_TEAM = "species_on_team"
    ORDER_OUT_OF_DATE = "order_out_of_date"
    POKEMON_REMOVED = "pokemon_removed"
    TEAM_ID_TAKEN = "team_id_taken"
