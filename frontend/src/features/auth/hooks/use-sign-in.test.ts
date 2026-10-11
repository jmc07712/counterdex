import { act, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useCurrentUser } from '@/lib/auth'
import { holdNextCurrentUser, serveSession } from '@/test/handlers'
import { renderHookWithProviders } from '@/test/render'
import { ASH, ASH_CREDENTIALS } from '@/test/users'

import { useSignIn } from './use-sign-in'

describe('useSignIn', () => {
  it('isn’t undone by a check of who’s signed in that began before signing in', async () => {
    serveSession()
    const { result } = renderHookWithProviders(() => ({
      user: useCurrentUser(),
      signIn: useSignIn(),
    }))
    await waitFor(() => expect(result.current.user.data).toBeNull())

    const release = holdNextCurrentUser(null)
    void result.current.user.refetch()
    await act(() => result.current.signIn.mutateAsync(ASH_CREDENTIALS))
    release()

    await waitFor(() => expect(result.current.user.fetchStatus).toBe('idle'))
    expect(result.current.user.data).toEqual(ASH)
  })
})
