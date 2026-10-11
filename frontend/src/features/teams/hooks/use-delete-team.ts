import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteTeam, type Team } from '@/api'
import {
  listTeamsInfiniteQueryKey,
  listUserTeamsQueryKey,
} from '@/api/@tanstack/react-query.gen'

import { TeamChangeError } from '../utils/team-change-error'
import { teamQueryOptions } from './use-team'
import { teamChangeScope } from './use-team-change'

/** Deletes the team, after any changes to it that are still on their way. */
export function useDeleteTeam(team: Team) {
  const queryClient = useQueryClient()
  return useMutation({
    scope: teamChangeScope(team.id),
    mutationFn: async () => {
      const { error, response } = await deleteTeam({ path: { team_id: team.id } })
      // Already gone is as good as deleted.
      if (error !== undefined && response?.status !== 404) {
        throw new TeamChangeError(response, error)
      }
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: teamQueryOptions(team.id).queryKey })
      const path = { username: team.owner.username }
      void queryClient.invalidateQueries({ queryKey: listTeamsInfiniteQueryKey() })
      return queryClient.invalidateQueries({ queryKey: listUserTeamsQueryKey({ path }) })
    },
  })
}
