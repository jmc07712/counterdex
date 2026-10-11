import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { Team } from '@/api'

import type { MatchupPool } from '../types'
import { counterTeamName } from '../utils/team-name'
import { counterTeamQueryOptions } from './use-counter-team'
import { useCreateTeam } from './use-create-team'

/**
 * The API's 503 for a counter team: no sync has stored enough to find one yet, whether the type
 * chart or enough Pokémon to choose from.
 */
export class PokedexNotSyncedError extends Error {}

type CounterTo = {
  // The new team's id, made by the caller, as for useCreateTeam.
  id: string
  team: Team
  pool: MatchupPool
}

/**
 * Builds a counter to `team`, picked from `pool`: the counter already shown for them if it's
 * cached and fresh, or a new one from the API, created as a new team named after `team`, with the
 * counter's Pokémon in its battle order. If the API finds no counter, no team is created.
 */
export function useBuildCounterTeam() {
  const queryClient = useQueryClient()
  const createTeam = useCreateTeam()
  return useMutation({
    mutationFn: async ({ id, team, pool }: CounterTo) => {
      const counter = await queryClient.fetchQuery(counterTeamQueryOptions(team.members, pool))
      if (counter === null) throw new PokedexNotSyncedError()
      return createTeam.mutateAsync({
        id,
        name: counterTeamName(team.name),
        pokemonIds: counter.map((challenger) => challenger.pokemon.id),
      })
    },
  })
}
