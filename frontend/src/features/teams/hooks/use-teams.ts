import { useQuery } from '@tanstack/react-query'

import { listTeamsOptions } from '@/api/@tanstack/react-query.gen'

export const teamsQueryKey = listTeamsOptions().queryKey

/** The signed-in user's teams, most recently changed first. */
export function useTeams({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ ...listTeamsOptions(), enabled })
}
