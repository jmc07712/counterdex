import { queryOptions, useQuery } from '@tanstack/react-query'

import { getTeam, type Team } from '@/api'
import { getTeamQueryKey } from '@/api/@tanstack/react-query.gen'

/** A team, whoever it belongs to; null if no team has this id. */
export function teamQueryOptions(teamId: string) {
  const path = { team_id: teamId }
  return queryOptions({
    queryKey: getTeamQueryKey({ path }),
    queryFn: async ({ signal }): Promise<Team | null> => {
      const { data, response } = await getTeam({ path, signal })
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
