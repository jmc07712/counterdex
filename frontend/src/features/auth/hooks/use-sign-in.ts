import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type CredentialsWritable, signIn } from '@/api'
import { setCurrentUser } from '@/lib/auth'

import { CredentialsError } from '../utils/credentials-error'

export function useSignIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: CredentialsWritable) => {
      const { data, response } = await signIn({ body })
      if (data === undefined) throw new CredentialsError(response)
      return data
    },
    onSuccess: (user) => setCurrentUser(queryClient, user),
  })
}
