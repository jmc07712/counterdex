import { useQueryClient } from '@tanstack/react-query'
import { act, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { listTeamsQueryKey } from '@/api/@tanstack/react-query.gen'
import { holdNextCurrentUser, serveSession } from '@/test/handlers'
import { renderHookWithProviders } from '@/test/render'
import { makeTeam, TEAM_ID } from '@/test/teams'
import { ASH } from '@/test/users'

import { useCurrentUser, useSignOut } from './auth'

describe('useCurrentUser', () => {
  it('is the signed-in user', async () => {
    serveSession({ signedIn: ASH })

    const { result } = renderHookWithProviders(() => useCurrentUser())

    await waitFor(() => expect(result.current.data).toEqual(ASH))
  })

  it('is null when nobody is signed in, rather than an error to retry', async () => {
    serveSession()

    const { result } = renderHookWithProviders(() => useCurrentUser())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('is an error, not nobody, when the check fails', async () => {
    serveSession({ refuse: { currentUser: 500 } })

    const { result } = renderHookWithProviders(() => useCurrentUser())

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('checks again whenever the app comes back into view', async () => {
    serveSession({ signedIn: ASH })
    const { result } = renderHookWithProviders(() => useCurrentUser())
    await waitFor(() => expect(result.current.data).toEqual(ASH))

    // Signed out in another tab.
    await fetch(new URL('/api/session', window.location.origin), { method: 'DELETE' })
    act(() => {
      fireEvent(window, new Event('visibilitychange'))
    })

    await waitFor(() => expect(result.current.data).toBeNull())
  })
})

describe('useSignOut', () => {
  // A check of who's signed in that began before signing out, and answers after.
  it('isn’t undone by a check that began before signing out', async () => {
    serveSession({ signedIn: ASH })
    const { result } = renderHookWithProviders(() => ({
      user: useCurrentUser(),
      signOut: useSignOut(),
    }))
    await waitFor(() => expect(result.current.user.data).toEqual(ASH))

    const release = holdNextCurrentUser(ASH)
    void result.current.user.refetch()
    await act(() => result.current.signOut.mutateAsync())
    release()

    await waitFor(() => expect(result.current.user.fetchStatus).toBe('idle'))
    expect(result.current.user.data).toBeNull()
  })

  it('forgets the user’s teams on signing out', async () => {
    serveSession({ signedIn: ASH })
    const { result } = renderHookWithProviders(() => ({
      signOut: useSignOut(),
      client: useQueryClient(),
    }))
    const teamKey = [...listTeamsQueryKey(), TEAM_ID]
    result.current.client.setQueryData(listTeamsQueryKey(), [])
    result.current.client.setQueryData(teamKey, makeTeam())

    await act(() => result.current.signOut.mutateAsync())

    expect(result.current.client.getQueryData(listTeamsQueryKey())).toBeUndefined()
    expect(result.current.client.getQueryData(teamKey)).toBeUndefined()
  })
})
