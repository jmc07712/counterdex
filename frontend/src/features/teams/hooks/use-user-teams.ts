import { type QueryClient, useQuery } from '@tanstack/react-query'

import { listTeamsInfiniteQueryKey, listUserTeamsOptions } from '@/api/@tanstack/react-query.gen'

/** A user's teams, most recently changed first. Nothing is fetched without a username. */
export function useUserTeams(username: string | undefined) {
  return useQuery({
    ...listUserTeamsOptions({ path: { username: username ?? '' } }),
    enabled: username !== undefined,
  })
}

/**
 * Has the lists that show a user's teams fetched again after one of them changed: everyone's,
 * and the user's own, which the promise it returns waits for.
 */
export function invalidateTeamLists(queryClient: QueryClient, username: string) {
  void queryClient.invalidateQueries({ queryKey: listTeamsInfiniteQueryKey() })
  return queryClient.invalidateQueries({
    queryKey: listUserTeamsOptions({ path: { username } }).queryKey,
  })
}
