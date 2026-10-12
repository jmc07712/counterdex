import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'

import { findCounterTeam, type TeamMember } from '@/api'
import { findCounterTeamQueryKey } from '@/api/@tanstack/react-query.gen'
import { dataOrNull } from '@/lib/queries'

import type { MatchupPool } from '../types'
import { matchupQuery, matchupStaleTime } from '../utils/matchup-query'

/**
 * A counter to a team with these members, picked from `pool`: our picks in battle order, each
 * with its matchup against each member. Null if no sync has stored enough to pick one yet.
 */
export function counterTeamQueryOptions(members: TeamMember[], pool: MatchupPool) {
  const query = matchupQuery(members, pool)
  return queryOptions({
    queryKey: findCounterTeamQueryKey({ query }),
    queryFn: ({ signal }) => dataOrNull(findCounterTeam({ query, signal }), 503),
    staleTime: matchupStaleTime,
  })
}

/** The counter for these members and pool, keeping the last one while another loads. */
export function useCounterTeam(members: TeamMember[], pool: MatchupPool) {
  return useQuery({ ...counterTeamQueryOptions(members, pool), placeholderData: keepPreviousData })
}
