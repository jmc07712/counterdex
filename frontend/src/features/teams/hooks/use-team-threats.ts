import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { listTeamThreats, type TeamMember } from '@/api'
import { listTeamThreatsQueryKey } from '@/api/@tanstack/react-query.gen'
import { dataOrNull } from '@/lib/queries'

import type { MatchupPool } from '../types'
import { matchupQuery, matchupStaleTime } from '../utils/matchup-query'

/**
 * Up to 12 Pokémon from `pool` that match up best against a team with these members, the biggest
 * threat first, each with its matchup against each member, scored from the threat's side. Null if
 * no sync has stored enough to find them yet. The last threats stay while others load.
 */
export function useTeamThreats(members: TeamMember[], pool: MatchupPool) {
  const query = matchupQuery(members, pool)
  return useQuery({
    queryKey: listTeamThreatsQueryKey({ query }),
    queryFn: ({ signal }) => dataOrNull(listTeamThreats({ query, signal }), 503),
    staleTime: matchupStaleTime,
    placeholderData: keepPreviousData,
  })
}
