import { useMutation } from '@tanstack/react-query'

import { findCounterTeam, type Team } from '@/api'

import { counterTeamName } from '../utils/team-name'
import { useCreateTeam } from './use-create-team'

/** The API's 503 for a counter team: no sync has stored what it's worked out from yet. */
export class PokedexNotSyncedError extends Error {}

type CounterTo = {
  // The new team's id, made by the caller, as for useCreateTeam.
  id: string
  team: Team
}

/**
 * Builds a counter to `team`: asks the API for one, then creates it as a new team, named after
 * `team`, with the counter's Pokémon in its battle order. If the API finds no counter, no team is
 * created.
 */
export function useBuildCounterTeam() {
  const createTeam = useCreateTeam()
  return useMutation({
    mutationFn: async ({ id, team }: CounterTo) => {
      const { data, response } = await findCounterTeam({
        query: { pokemon_id: team.members.map((member) => member.pokemon.id) },
      })
      if (response?.status === 503) throw new PokedexNotSyncedError()
      if (data === undefined) throw new Error(`GET /api/counter-team failed: ${response?.status}`)
      return createTeam.mutateAsync({
        id,
        name: counterTeamName(team.name),
        pokemonIds: data.map((challenger) => challenger.pokemon.id),
      })
    },
  })
}
