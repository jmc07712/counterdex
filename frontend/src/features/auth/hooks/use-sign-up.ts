import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type NewAccountWritable, signUp } from '@/api'
import { setCurrentUser } from '@/lib/auth'

import { CredentialsError } from '../utils/credentials-error'

export function useSignUp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: NewAccountWritable) => {
      const { data, response } = await signUp({ body })
      if (data === undefined) throw new CredentialsError(response)
      return data
    },
    onSuccess: (user) => setCurrentUser(queryClient, user),
  })
}
