import { reorderTeam, type Team } from '@/api'

import { withOrder } from '../utils/changed-team'
import { teamAfter } from '../utils/team-change-error'
import { useTeamChange } from './use-team-change'

/** Puts the team's members in the order of these Pokémon ids. */
export function useReorderTeam(team: Team) {
  const path = { team_id: team.id }
  return useTeamChange(team, {
    send: (pokemonIds: number[]) =>
      teamAfter(reorderTeam({ path, body: { pokemon_ids: pokemonIds } })),
    apply: withOrder,
  })
}
