import { removeTeamMember, type Team } from '@/api'

import { withRemoved } from '../utils/changed-team'
import { teamAfter } from '../utils/team-change-error'
import { useTeamChange } from './use-team-change'

/** Takes a Pokémon off the team; the members after it move up a slot. */
export function useRemoveTeamMember(team: Team) {
  return useTeamChange(team, {
    send: (pokemonId: number) =>
      teamAfter(removeTeamMember({ path: { team_id: team.id, pokemon_id: pokemonId } })),
    apply: withRemoved,
  })
}
