import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { type Challenger, listTeamThreats, type TeamMember } from '@/api'
import { listTeamThreatsQueryKey } from '@/api/@tanstack/react-query.gen'

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
    queryFn: async ({ signal }): Promise<Challenger[] | null> => {
      const { data, response } = await listTeamThreats({ query, signal })
      if (response?.status === 503) return null
      if (data === undefined) throw new Error(`GET /api/team-threats failed: ${response?.status}`)
      return data
    },
    staleTime: matchupStaleTime,
    placeholderData: keepPreviousData,
  })
}
