import { useQueryClient } from '@tanstack/react-query'
import { act, waitFor } from '@testing-library/react'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'

import { TeamConflictReason } from '@/api'
import { listUserTeamsOptions } from '@/api/@tanstack/react-query.gen'
import { refuseTeamChange, serveTeams } from '@/test/handlers/teams'
import { renderHookWithProviders } from '@/test/render'
import { holdRequests, server } from '@/test/server'
import { catalog, makeTeam, memberIds, TEAM_ID } from '@/test/teams'
import { ASH } from '@/test/users'

import { useRemoveTeamMember } from './use-remove-team-member'
import { useTeam } from './use-team'
import { useUserTeams } from './use-user-teams'

const { charmander, pikachu, gengar, lapras } = catalog
const TEAM = makeTeam({ pokemon: [charmander, pikachu] })
// Another of the owner's teams.
const OTHER = makeTeam({
  id: '00000000-0000-4000-8000-000000000002',
  name: 'Team 2',
  pokemon: [gengar, lapras],
})

// The team as fetched, its owner's teams as listed, and a way to remove its members.
async function renderRemove() {
  const { result } = renderHookWithProviders(() => ({
    shown: useTeam(TEAM_ID),
    listed: useUserTeams(ASH.username),
    remove: useRemoveTeamMember(TEAM),
  }))
  await waitFor(() => expect(result.current.shown.data).toBeTruthy())
  await waitFor(() => expect(result.current.listed.data).toBeTruthy())
  return result
}

// Holds the removal of this member until `release` is called, then lets the stand-in answer it.
function holdRemoving(pokemonId: number) {
  return holdRequests('delete', `/api/teams/:teamId/members/${pokemonId}`)
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
    refuseTeamChange(
      TeamConflictReason.ORDER_OUT_OF_DATE,
      `/api/teams/:teamId/members/${charmander.id}`,
    )
    const later = holdRemoving(pikachu.id)
    const result = await renderRemove()

    let refused: Promise<unknown> = Promise.resolve()
    act(() => {
      refused = result.current.remove(charmander.id)
      void result.current.remove(pikachu.id)
    })
    expect(await refused).toBeUndefined()
    await waitFor(() => expect(later.arrived()).toBe(1))

    // Given time, both changes still show: the refused one isn't undone under the later one.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(memberIds(result.current.shown.data)).toEqual([])
    expect(memberIds(result.current.listed.data?.[0])).toEqual([])

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
    await waitFor(() => expect(later.arrived()).toBe(1))
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

  it('shows a change in its owner’s list of teams, and undoes it there too if refused', async () => {
    serveTeams({ teams: [TEAM], catalog: Object.values(catalog), signedIn: ASH })
    refuseTeamChange(
      TeamConflictReason.ORDER_OUT_OF_DATE,
      `/api/teams/:teamId/members/${charmander.id}`,
    )
    const refusing = holdRemoving(charmander.id)
    const result = await renderRemove()
    // The list's fetch once the change settles waits, so what it shows is the change's doing.
    const fetches = holdRequests('get', '/api/users/:username/teams')

    let refused: Promise<unknown> = Promise.resolve()
    act(() => {
      refused = result.current.remove(charmander.id)
    })
    await waitFor(() => expect(memberIds(result.current.listed.data?.[0])).toEqual([pikachu.id]))
    refusing.release()
    expect(await refused).toBeUndefined()

    await waitFor(() =>
      expect(memberIds(result.current.listed.data?.[0])).toEqual([charmander.id, pikachu.id]),
    )
    expect(fetches.arrived()).toBe(1)
    fetches.release()
  })

  it('undoes a refused change only to its own team in the list, keeping others’ changes', async () => {
    serveTeams({ teams: [TEAM, OTHER], catalog: Object.values(catalog), signedIn: ASH })
    refuseTeamChange(
      TeamConflictReason.ORDER_OUT_OF_DATE,
      `/api/teams/${TEAM_ID}/members/${charmander.id}`,
    )
    const refusing = holdRequests('delete', `/api/teams/${TEAM_ID}/members/${charmander.id}`)
    const { result } = renderHookWithProviders(() => ({
      listed: useUserTeams(ASH.username),
      removeFromTeam: useRemoveTeamMember(TEAM),
      removeFromOther: useRemoveTeamMember(OTHER),
    }))
    await waitFor(() => expect(result.current.listed.data).toHaveLength(2))
    const listedMembers = (teamId: string) =>
      memberIds(result.current.listed.data?.find((each) => each.id === teamId))
    // The list's fetches once each change settles wait, so what it shows is the changes' doing.
    const fetches = holdRequests('get', '/api/users/:username/teams')

    let refused: Promise<unknown> = Promise.resolve()
    let removed: Promise<unknown> = Promise.resolve()
    act(() => {
      refused = result.current.removeFromTeam(charmander.id)
    })
    await waitFor(() => expect(listedMembers(TEAM_ID)).toEqual([pikachu.id]))
    act(() => {
      removed = result.current.removeFromOther(gengar.id)
    })
    expect(await removed).toBeTruthy()
    await waitFor(() => expect(listedMembers(OTHER.id)).toEqual([lapras.id]))

    refusing.release()
    expect(await refused).toBeUndefined()

    await waitFor(() => expect(listedMembers(TEAM_ID)).toEqual([charmander.id, pikachu.id]))
    expect(listedMembers(OTHER.id)).toEqual([lapras.id])
    fetches.release()
  })

  it('leaves its owner’s list waiting to be fetched again when the team isn’t in it', async () => {
    serveTeams({ teams: [TEAM, OTHER], catalog: Object.values(catalog), signedIn: ASH })
    const held = holdRemoving(charmander.id)
    const { result } = renderHookWithProviders(() => ({
      client: useQueryClient(),
      remove: useRemoveTeamMember(TEAM),
    }))
    const listKey = listUserTeamsOptions({ path: { username: ASH.username } }).queryKey
    // Listed before the team was made, then marked to be fetched again when next shown.
    act(() => {
      result.current.client.setQueryData(listKey, [OTHER])
      void result.current.client.invalidateQueries({ queryKey: listKey })
    })

    act(() => {
      void result.current.remove(charmander.id)
    })
    await waitFor(() => expect(held.arrived()).toBe(1))

    expect(result.current.client.getQueryState(listKey)?.isInvalidated).toBe(true)
    held.release()
  })
})
