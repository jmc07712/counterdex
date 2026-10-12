import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TeamConflictReason } from '@/api'
import { browse, servePokemonChanges, servePokemonDetails } from '@/test/handlers/pokemon'
import { refuseTeamChange, serveAsh } from '@/test/handlers/teams'
import { holdRequests } from '@/test/server'
import { EDIT, renderTeam, serveTeamSections, slotRows } from '@/test/team-page'
import { asMember, catalog, makeTeam, memberIds, TEAM_ID } from '@/test/teams'

const { charmander, charizard, pikachu, snorlax } = catalog

beforeEach(serveTeamSections)

describe('TeamPage, putting a team in a new order', () => {
  const ORDER = `/api/teams/${TEAM_ID}/order`

  // jsdom doesn't lay pages out. This stacks the slots 80px apart, as the Edit column does, so
  // the arrow keys find a slot above or below the one picked up.
  function stackSlots() {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const slot = this.closest('li')
      const index = slot?.parentElement ? [...slot.parentElement.children].indexOf(slot) : 0
      const top = index * 80
      return {
        x: 0,
        y: top,
        left: 0,
        top,
        right: 320,
        bottom: top + 72,
        width: 320,
        height: 72,
        toJSON: () => ({}),
      }
    })
  }

  // The names in the members' slots, in order.
  function memberNames() {
    return slotRows().flatMap((row) => within(row).queryByRole('heading')?.textContent ?? [])
  }

  // Picks up the member's slot with its handle, presses each of `keys`, then drops it.
  async function move(user: ReturnType<typeof renderTeam>['user'], name: string, keys: string[]) {
    const handle = await screen.findByRole('button', { name: `Move ${name}` })
    handle.focus()
    await user.keyboard('[Space]')
    for (const key of keys) await user.keyboard(`[${key}]`)
    await user.keyboard('[Space]')
  }

  it('moves a slot with the keyboard, and sends the new order', async () => {
    stackSlots()
    const api = serveAsh([makeTeam({ pokemon: [charmander, pikachu, snorlax] })])
    browse([])
    const { user } = renderTeam(EDIT)

    await move(user, 'Charmander', ['ArrowDown', 'ArrowDown'])

    expect(memberNames()).toEqual(['Pikachu', 'Snorlax', 'Charmander'])
    await waitFor(() => expect(memberIds(api.teams()[0])).toEqual([25, 143, 4]))
    expect(api.requests).toEqual([{ method: 'PUT', path: ORDER, body: { pokemon_ids: [25, 143, 4] } }])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Move Charmander' })).toHaveFocus())
  })

  it('says how to move a slot, and reads out where it’s picked up, moved and dropped', async () => {
    stackSlots()
    serveAsh([makeTeam({ pokemon: [charmander, pikachu, snorlax] })])
    browse([])
    const { user } = renderTeam(EDIT)

    const handle = await screen.findByRole('button', { name: 'Move Pikachu' })
    expect(handle).toHaveAccessibleDescription(
      'Press Space to pick up this Pokémon, the arrow keys to move it, and Space again to drop it in its new slot. Escape cancels.',
    )
    handle.focus()
    await user.keyboard('[Space]')
    expect(await screen.findByText('Picked up Pikachu, slot 2 of 3')).toBeInTheDocument()
    await user.keyboard('[ArrowUp]')
    expect(await screen.findByText('Pikachu moved to slot 1')).toBeInTheDocument()
    await user.keyboard('[Space]')
    expect(await screen.findByText('Pikachu dropped in slot 1')).toBeInTheDocument()
  })

  it('leaves the order as it was when a move is cancelled, and says so', async () => {
    stackSlots()
    const api = serveAsh([makeTeam({ pokemon: [charmander, pikachu] })])
    browse([])
    const { user } = renderTeam(EDIT)

    const handle = await screen.findByRole('button', { name: 'Move Charmander' })
    handle.focus()
    await user.keyboard('[Space]')
    await user.keyboard('[ArrowDown]')
    await user.keyboard('[Escape]')

    expect(await screen.findByText('Cancelled. Charmander is back in slot 1')).toBeInTheDocument()
    expect(memberNames()).toEqual(['Charmander', 'Pikachu'])
    expect(api.requests).toEqual([])
  })

  it('shows the new order at once, before the API answers', async () => {
    stackSlots()
    const api = serveAsh([makeTeam({ pokemon: [charmander, pikachu] })])
    browse([])
    const hold = holdRequests('put', '/api/teams/:teamId/order')
    const { user } = renderTeam(EDIT)

    await move(user, 'Pikachu', ['ArrowUp'])

    expect(memberNames()).toEqual(['Pikachu', 'Charmander'])
    expect(slotRows()[0]).toHaveTextContent(/^1/)
    await waitFor(() => expect(hold.arrived()).toBe(1))
    expect(memberIds(api.teams()[0])).toEqual([4, 25])
    hold.release()
    await waitFor(() => expect(memberIds(api.teams()[0])).toEqual([25, 4]))
  })

  it('puts the order back, and says why, when the API refuses it', async () => {
    stackSlots()
    serveAsh([makeTeam({ pokemon: [charmander, pikachu] })])
    browse([])
    refuseTeamChange(TeamConflictReason.ORDER_OUT_OF_DATE)
    const { user, queryClient } = renderTeam(EDIT)
    await screen.findByRole('button', { name: 'Move Pikachu' })
    // Held, so what shows is the order put back rather than the team fetched again.
    const fetches = holdRequests('get', '/api/teams/:teamId')

    await move(user, 'Pikachu', ['ArrowUp'])

    expect(
      await screen.findByText('This team changed somewhere else, so it’s been reloaded.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(memberNames()).toEqual(['Charmander', 'Pikachu']))
    fetches.release()
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(memberNames()).toEqual(['Charmander', 'Pikachu'])
  })

  it('moves only members, and nothing past the last of them', async () => {
    stackSlots()
    const api = serveAsh([makeTeam({ pokemon: [charmander, pikachu] })])
    browse([])
    const { user } = renderTeam(EDIT)

    await move(user, 'Pikachu', ['ArrowDown', 'ArrowDown'])

    expect(screen.getAllByRole('button', { name: /^Move / })).toHaveLength(2)
    for (const row of slotRows().slice(2)) {
      expect(within(row).queryByRole('button')).not.toBeInTheDocument()
    }
    expect(memberNames()).toEqual(['Charmander', 'Pikachu'])
    expect(api.requests).toEqual([])
  })

  it('moves a member removed from the Pokédex like any other', async () => {
    stackSlots()
    const api = serveAsh([
      makeTeam({
        members: [
          asMember(charmander, 0),
          { ...asMember(pikachu, 1), removed_at: '2026-10-11T09:00:00Z' },
        ],
      }),
    ])
    browse([])
    const { user } = renderTeam(EDIT)

    await move(user, 'Pikachu', ['ArrowUp'])

    await waitFor(() => expect(memberIds(api.teams()[0])).toEqual([25, 4]))
  })

  it('makes the member moved to slot 1 the lead', async () => {
    stackSlots()
    serveAsh([makeTeam({ pokemon: [charmander, pikachu] })])
    browse([])
    const { user, queryClient } = renderTeam(EDIT)

    await move(user, 'Pikachu', ['ArrowUp'])
    await waitFor(() => expect(queryClient.isMutating()).toBe(0))
    await user.click(screen.getByRole('link', { name: 'View' }))

    const lead = (await screen.findByText('Lead')).closest('li')!
    expect(within(lead).getByRole('heading', { level: 2 })).toHaveTextContent('Pikachu')
  })

  it('opens a member’s details from a tap on its slot, rather than moving it', async () => {
    stackSlots()
    const api = serveAsh([makeTeam({ pokemon: [charmander, charizard] })])
    browse([])
    servePokemonDetails()
    servePokemonChanges()
    const { user, router } = renderTeam(EDIT)

    await screen.findByRole('button', { name: 'Move Charizard' })
    await user.click(within(slotRows()[1]).getByRole('button', { name: 'Charizard' }))

    expect(await screen.findByRole('dialog', { name: 'Charizard' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?pokemon=6')
    expect(api.requests).toEqual([])
  })
})
