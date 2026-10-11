import { act, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { describe, expect, it, vi } from 'vitest'

import { holdTeamFetches, serveTeams } from '@/test/handlers'
import { renderHookWithProviders } from '@/test/render'
import { catalog, makeTeam, TEAM_ID } from '@/test/teams'
import { ASH, MISTY } from '@/test/users'

import { useTeam } from './use-team'
import { useTeamEditor } from './use-team-editor'

const { charmander, charizard, pikachu } = catalog
const CATALOG = Object.values(catalog)
const TEAM = makeTeam({ pokemon: [charmander, pikachu] })

// The team as fetched, and an editor for it.
async function renderEditor() {
  const { result } = renderHookWithProviders(() => ({
    shown: useTeam(TEAM_ID),
    editor: useTeamEditor(TEAM),
  }))
  await waitFor(() => expect(result.current.shown.data).toBeTruthy())
  return result
}

function memberIds(team: { members: { pokemon: { id: number } }[] } | null | undefined) {
  return team?.members.map((member) => member.pokemon.id)
}

describe('useTeamEditor', () => {
  it('reorders the team, resolving to it as the API answers', async () => {
    const api = serveTeams({ teams: [TEAM], catalog: CATALOG, signedIn: ASH })
    const result = await renderEditor()

    const changed = await act(() => result.current.editor.reorder([25, 4]))

    expect(memberIds(changed)).toEqual([25, 4])
    expect(api.requests).toEqual([
      { method: 'PUT', path: `/api/teams/${TEAM_ID}/order`, body: { pokemon_ids: [25, 4] } },
    ])
  })

  it('replaces a member, resolving to the team as the API answers', async () => {
    const api = serveTeams({ teams: [TEAM], catalog: CATALOG, signedIn: ASH })
    const result = await renderEditor()

    const changed = await act(() => result.current.editor.replace(4, charizard))

    expect(memberIds(changed)).toEqual([6, 25])
    expect(api.requests).toEqual([
      { method: 'PUT', path: `/api/teams/${TEAM_ID}/members/4`, body: { pokemon_id: 6 } },
    ])
  })

  it('undoes a change someone else’s team refuses, and says why', async () => {
    const error = vi.spyOn(toast, 'error')
    serveTeams({ teams: [TEAM], catalog: CATALOG, signedIn: MISTY })
    const result = await renderEditor()
    const fetches = holdTeamFetches()

    const changed = await act(() => result.current.editor.remove(4))

    expect(changed).toBeUndefined()
    expect(error).toHaveBeenCalledWith('Only the team’s owner can change it.')
    // While the team is fetched again, it shows as it was before the change.
    await waitFor(() => expect(result.current.shown.isFetching).toBe(true))
    expect(memberIds(result.current.shown.data)).toEqual([4, 25])
    fetches.release()
    await waitFor(() => expect(result.current.shown.isFetching).toBe(false))
  })
})
