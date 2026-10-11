import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createTeam } from '@/api'

import { TeamChangeError } from '../utils/team-change-error'
import { teamQueryOptions } from './use-team'
import { teamsQueryKey } from './use-teams'

type NewTeam = { id: string; name: string; pokemonIds?: number[] }

/**
 * Creates a team with an id made by the caller. The API returns the team it already made for a
 * repeated id, so retrying with the same id can't make two.
 */
export function useCreateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name, pokemonIds = [] }: NewTeam) => {
      const { data, error, response } = await createTeam({
        path: { team_id: id },
        body: { name, pokemon_ids: pokemonIds },
      })
      if (data === undefined) throw new TeamChangeError(response, error)
      return data
    },
    onSuccess: (team) => {
      queryClient.setQueryData(teamQueryOptions(team.id).queryKey, team)
      return queryClient.invalidateQueries({ queryKey: teamsQueryKey })
    },
  })
}
