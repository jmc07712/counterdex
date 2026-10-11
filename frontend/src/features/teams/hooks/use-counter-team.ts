import { queryOptions, useQuery } from '@tanstack/react-query'

import { type Challenger, findCounterTeam, type TeamMember } from '@/api'
import { findCounterTeamQueryKey } from '@/api/@tanstack/react-query.gen'

import type { MatchupPool } from '../types'
import { matchupQuery } from '../utils/matchup-query'

/**
 * A counter to a team with these members, picked from `pool`: our picks in battle order, each
 * with its matchup against each member. Null if no sync has stored enough to pick one yet.
 */
export function counterTeamQueryOptions(members: TeamMember[], pool: MatchupPool) {
  const query = matchupQuery(members, pool)
  return queryOptions({
    queryKey: findCounterTeamQueryKey({ query }),
    queryFn: async ({ signal }): Promise<Challenger[] | null> => {
      const { data, response } = await findCounterTeam({ query, signal })
      if (response?.status === 503) return null
      if (data === undefined) throw new Error(`GET /api/counter-team failed: ${response?.status}`)
      return data
    },
  })
}

export function useCounterTeam(members: TeamMember[], pool: MatchupPool) {
  return useQuery(counterTeamQueryOptions(members, pool))
}
