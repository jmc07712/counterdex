import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { getCurrentUser, signOut, type User } from '@/api'
import { getCurrentUserQueryKey } from '@/api/@tanstack/react-query.gen'

/** Who's signed in: a user, or null for nobody. */
export const currentUserOptions = queryOptions({
  queryKey: getCurrentUserQueryKey(),
  queryFn: async ({ signal }): Promise<User | null> => {
    const { data, response } = await getCurrentUser({ signal })
    // The API answers 401 when nobody is signed in.
    if (response?.status === 401) return null
    if (data === undefined) throw new Error(`GET /api/session failed: ${response?.status}`)
    return data
  },
  // Checked again whenever the app comes back into view, however recently, as signing in or
  // out in another tab changes it.
  refetchOnWindowFocus: 'always',
})

export function useCurrentUser() {
  return useQuery(currentUserOptions)
}

/**
 * Sets who's signed in, after signing in, up or out. A check that began before would otherwise
 * overwrite it when it answers, so it's cancelled first.
 */
export async function setCurrentUser(queryClient: QueryClient, user: User | null) {
  await queryClient.cancelQueries({ queryKey: currentUserOptions.queryKey })
  queryClient.setQueryData(currentUserOptions.queryKey, user)
}

/** Signs out. On success the app knows nobody is signed in. */
export function useSignOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => signOut({ throwOnError: true }),
    onSuccess: () => setCurrentUser(queryClient, null),
  })
}
