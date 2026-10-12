import { queryOptions, useQuery } from '@tanstack/react-query'

import { getTeam } from '@/api'
import { getTeamQueryKey } from '@/api/@tanstack/react-query.gen'
import { dataOrNull } from '@/lib/queries'

/** A team, whoever it belongs to; null if no team has this id. */
export function teamQueryOptions(teamId: string) {
  const path = { team_id: teamId }
  return queryOptions({
    queryKey: getTeamQueryKey({ path }),
    queryFn: ({ signal }) => dataOrNull(getTeam({ path, signal }), 404),
  })
}

export function useTeam(teamId: string) {
  return useQuery(teamQueryOptions(teamId))
}
