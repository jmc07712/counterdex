import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteTeam } from '@/api'

import { TeamChangeError } from '../utils/team-change-error'
import { teamQueryOptions } from './use-team'
import { teamsQueryKey } from './use-teams'

export function useDeleteTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (teamId: string) => {
      const { error, response } = await deleteTeam({ path: { team_id: teamId } })
      // Already gone is as good as deleted.
      if (error !== undefined && response?.status !== 404) {
        throw new TeamChangeError(response, error)
      }
    },
    onSuccess: (_, teamId) => {
      queryClient.removeQueries({ queryKey: teamQueryOptions(teamId).queryKey })
      return queryClient.invalidateQueries({ queryKey: teamsQueryKey })
    },
  })
}
