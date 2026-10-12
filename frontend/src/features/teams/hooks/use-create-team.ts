import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createTeam } from '@/api'

import { teamAfter } from '../utils/team-change-error'
import { teamQueryOptions } from './use-team'
import { invalidateTeamLists } from './use-user-teams'

type NewTeam = { id: string; name: string; pokemonIds?: number[] }

/**
 * Creates a team with an id made by the caller. The API returns the team it already made for a
 * repeated id, so retrying with the same id can't make two.
 */
export function useCreateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name, pokemonIds = [] }: NewTeam) =>
      teamAfter(createTeam({ path: { team_id: id }, body: { name, pokemon_ids: pokemonIds } })),
    onSuccess: (team) => {
      queryClient.setQueryData(teamQueryOptions(team.id).queryKey, team)
      return invalidateTeamLists(queryClient, team.owner.username)
    },
  })
}
