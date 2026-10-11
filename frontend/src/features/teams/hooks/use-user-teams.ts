import { useQuery } from '@tanstack/react-query'

import { listUserTeamsOptions } from '@/api/@tanstack/react-query.gen'

/** A user's teams, most recently changed first. Nothing is fetched without a username. */
export function useUserTeams(username: string | undefined) {
  return useQuery({
    ...listUserTeamsOptions({ path: { username: username ?? '' } }),
    enabled: username !== undefined,
  })
}
