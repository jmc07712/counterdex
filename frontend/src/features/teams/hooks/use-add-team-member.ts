import { addTeamMember, type Pokemon, type Team } from '@/api'

import { withAdded } from '../utils/changed-team'
import { teamAfter } from '../utils/team-change-error'
import { useTeamChange } from './use-team-change'

/** Puts a Pokémon in the team's next free slot. */
export function useAddTeamMember(team: Team) {
  const path = { team_id: team.id }
  return useTeamChange(team, {
    send: (pokemon: Pokemon) =>
      teamAfter(addTeamMember({ path, body: { pokemon_id: pokemon.id } })),
    apply: withAdded,
  })
}
