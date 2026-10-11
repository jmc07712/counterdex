import { queryOptions, useQuery } from '@tanstack/react-query'

import { getTeam, type Team } from '@/api'
import { listTeamsQueryKey } from '@/api/@tanstack/react-query.gen'

/**
 * One of the signed-in user's teams; null if they have none with this id. Its key is under the
 * list's, so removing or invalidating the list's key covers every team too.
 */
export function teamQueryOptions(teamId: string) {
  const path = { team_id: teamId }
  return queryOptions({
    queryKey: [...listTeamsQueryKey(), teamId] as const,
    queryFn: async ({ signal }): Promise<Team | null> => {
      const { data, response } = await getTeam({ path, signal })
      // The API answers 404 for a team that doesn't exist or is someone else's.
      if (response?.status === 404) return null
      if (data === undefined) {
        throw new Error(`GET /api/teams/${teamId} failed: ${response?.status}`)
      }
      return data
    },
  })
}

export function useTeam(teamId: string) {
  return useQuery(teamQueryOptions(teamId))
}
