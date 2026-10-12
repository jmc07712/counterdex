import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { scoreTeams, type TeamMember } from '@/api'
import { scoreTeamsQueryKey } from '@/api/@tanstack/react-query.gen'
import { dataOrNull } from '@/lib/queries'

import { matchupStaleTime } from '../utils/matchup-query'

/**
 * How a team with `ours` matches up against one with `theirs`: each of ours with its matchup
 * against each of theirs. Null if no sync has stored enough to score them yet. It's asked for only
 * while both teams have Pokémon, and the last matchups stay while the next load.
 */
export function useTeamMatchups(ours: TeamMember[], theirs: TeamMember[]) {
  const query = {
    pokemon_id: ours.map((member) => member.pokemon.id),
    opponent_id: theirs.map((member) => member.pokemon.id),
  }
  return useQuery({
    queryKey: scoreTeamsQueryKey({ query }),
    queryFn: ({ signal }) => dataOrNull(scoreTeams({ query, signal }), 503),
    staleTime: matchupStaleTime,
    placeholderData: keepPreviousData,
    enabled: ours.length > 0 && theirs.length > 0,
  })
}
