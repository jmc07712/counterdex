import { act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { TeamConflictReason } from '@/api'
import { serveTeams } from '@/test/handlers'
import { renderHookWithProviders } from '@/test/render'
import { server } from '@/test/server'
import { catalog, makeTeam, TEAM_ID } from '@/test/teams'
import { ASH } from '@/test/users'

import { useRemoveTeamMember } from './use-remove-team-member'
import { useTeam } from './use-team'

const { charmander, pikachu } = catalog
const TEAM = makeTeam({ pokemon: [charmander, pikachu] })

// The team as fetched, and a way to remove its members.
async function renderRemove() {
  const { result } = renderHookWithProviders(() => ({
    shown: useTeam(TEAM_ID),
    remove: useRemoveTeamMember(TEAM),
  }))
  await waitFor(() => expect(result.current.shown.data).toBeTruthy())
  return result
}

function memberIds(team: { members: { pokemon: { id: number } }[] } | null | undefined) {
  return team?.members.map((member) => member.pokemon.id)
}

// Holds the removal of this member until `release` is called, then lets the stand-in answer it.
function holdRemoving(pokemonId: number) {
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let arrived = false
  server.use(
    http.delete(`/api/teams/:teamId/members/${pokemonId}`, async () => {
      arrived = true
      await released
    }),
  )
  return { release, arrived: () => arrived }
}

// Counts the fetches of the team from now on, which the stand-in still answers.
function countTeamFetches() {
  let count = 0
  server.use(
    http.get('/api/teams/:teamId', () => {
      count += 1
    }),
  )
  return () => count
}

describe('useTeamChange', () => {
  it('doesn’t undo a refused change while a later one is still on its way', async () => {
    serveTeams({ teams: [TEAM], catalog: Object.values(catalog), signedIn: ASH })
    server.use(
      http.delete(`/api/teams/:teamId/members/${charmander.id}`, () =>
        HttpResponse.json(
          { detail: 'Refused.', reason: TeamConflictReason.ORDER_OUT_OF_DATE },
          { status: 409 },
        ),
      ),
    )
    const later = holdRemoving(pikachu.id)
    const result = await renderRemove()

    let refused: Promise<unknown> = Promise.resolve()
    act(() => {
      refused = result.current.remove(charmander.id)
      void result.current.remove(pikachu.id)
    })
    expect(await refused).toBeUndefined()
    await waitFor(() => expect(later.arrived()).toBe(true))

    // Given time, both changes still show: the refused one isn't undone under the later one.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(memberIds(result.current.shown.data)).toEqual([])

    later.release()
    // Once the last settles, the team is fetched again and shows as it really is.
    await waitFor(() => expect(memberIds(result.current.shown.data)).toEqual([charmander.id]))
  })

  it('fetches the team once, after the last of its changes settles', async () => {
    serveTeams({ teams: [TEAM], catalog: Object.values(catalog), signedIn: ASH })
    const later = holdRemoving(pikachu.id)
    const result = await renderRemove()
    const fetches = countTeamFetches()

    let first: Promise<unknown> = Promise.resolve()
    act(() => {
      first = result.current.remove(charmander.id)
      void result.current.remove(pikachu.id)
    })
    await first
    await waitFor(() => expect(later.arrived()).toBe(true))
    // Given time, the first has settled, but the team isn't fetched while the second waits.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fetches()).toBe(0)

    later.release()

    await waitFor(() => expect(fetches()).toBe(1))
    await waitFor(() => expect(result.current.shown.isFetching).toBe(false))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fetches()).toBe(1)
    expect(memberIds(result.current.shown.data)).toEqual([])
  })
})
