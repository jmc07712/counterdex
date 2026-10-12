import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { browse } from '@/test/handlers/pokemon'
import { serveAsh } from '@/test/handlers/teams'
import { onWideScreen } from '@/test/media'
import { EDIT, renderTeam, serveTeamSections, slotRows } from '@/test/team-page'
import { asMember, catalog, makeTeam, memberIds, TEAM_ID } from '@/test/teams'

const { charmander, charizard, pikachu, snorlax, lapras, eevee, vaporeon } = catalog

beforeEach(serveTeamSections)

describe('TeamPage, choosing a Pokémon to replace a member', () => {
  const REMOVED_ON = '2026-10-11T09:00:00Z'
  // Charmander was removed from the Pokédex.
  const TEAM = makeTeam({
    members: [{ ...asMember(charmander, 0), removed_at: REMOVED_ON }, asMember(pikachu, 1)],
  })
  const REPLACE = `${EDIT}?replace=${charmander.id}`

  it('offers to replace each removed member from its slot, keeping the Pokédex’s filters', async () => {
    onWideScreen()
    serveAsh([TEAM])
    browse([snorlax])
    const { user } = renderTeam(`${EDIT}?q=snor`)

    await screen.findByRole('button', { name: 'Move Charmander' })
    const [charmanderSlot, pikachuSlot] = slotRows()
    const link = within(charmanderSlot).getByRole('link', { name: 'Replace Charmander' })
    expect(link).toHaveAttribute('href', `${EDIT}?q=snor&replace=4`)
    expect(within(pikachuSlot).queryByRole('link', { name: /Replace/ })).not.toBeInTheDocument()
    await user.click(link)

    const pokedex = screen.getByRole('complementary', { name: 'Add Pokémon' })
    expect(within(pokedex).getByText('Choose a Pokémon to replace Charmander')).toBeInTheDocument()
    expect(
      await within(pokedex).findByRole('button', { name: 'Replace Charmander with Snorlax' }),
    ).toBeInTheDocument()
  })

  it('opens the Pokédex on phones once a slot’s Replace link is followed', async () => {
    serveAsh([TEAM])
    browse([snorlax])
    const { user } = renderTeam(EDIT)

    await user.click(await screen.findByRole('link', { name: 'Replace Charmander' }))

    const sheet = await screen.findByRole('dialog', { name: 'Add Pokémon' })
    expect(within(sheet).getByText('Choose a Pokémon to replace Charmander')).toBeInTheDocument()
  })

  it('asks for a Pokémon to replace the member, and replaces it with the one chosen', async () => {
    onWideScreen()
    const api = serveAsh([TEAM])
    browse([pikachu, snorlax])
    const { user, router, queryClient } = renderTeam(REPLACE)

    // Once, above the Pokédex beside the team, rather than in the team's column.
    expect(await screen.findByText('Choose a Pokémon to replace Charmander')).toBeInTheDocument()
    const pokedex = screen.getByRole('complementary', { name: 'Add Pokémon' })
    expect(within(pokedex).getByText('Choose a Pokémon to replace Charmander')).toBeInTheDocument()
    expect(
      await within(pokedex).findByRole('button', { name: 'Pikachu is on the team' }),
    ).toBeInTheDocument()
    const button = within(pokedex).getByRole('button', { name: 'Replace Charmander with Snorlax' })
    expect(button).toHaveTextContent('Replace Charmander')

    await user.click(button)

    await waitFor(() => expect(memberIds(api.teams()[0])).toEqual([143, 25]))
    expect(api.requests).toEqual([
      { method: 'PUT', path: `/api/teams/${TEAM_ID}/members/4`, body: { pokemon_id: 143 } },
    ])
    expect(router.state.location.search).toBe('')
    expect(screen.queryByText('Choose a Pokémon to replace Charmander')).not.toBeInTheDocument()
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(button).toHaveAccessibleName('Snorlax is on the team')
    expect(button).toHaveFocus()
  })

  it('offers the member’s own family, and says when another member’s family is on the team', async () => {
    onWideScreen()
    const api = serveAsh([
      makeTeam({
        members: [{ ...asMember(charmander, 0), removed_at: REMOVED_ON }, asMember(vaporeon, 1)],
      }),
    ])
    browse([charizard, eevee])
    const { user } = renderTeam(REPLACE)

    const pokedex = await screen.findByRole('complementary', { name: 'Add Pokémon' })
    const charizardCard = await within(pokedex).findByRole('article', { name: 'Charizard' })
    expect(
      within(charizardCard).getByRole('button', { name: 'Replace Charmander with Charizard' }),
    ).not.toHaveAttribute('aria-disabled', 'true')
    const eeveeCard = within(pokedex).getByRole('article', { name: 'Eevee' })
    const blocked = within(eeveeCard).getByRole('button', { name: 'Replace Charmander with Eevee' })
    expect(blocked).toHaveAttribute('aria-disabled', 'true')
    expect(blocked).toHaveAccessibleDescription('Vaporeon’s family is on the team')

    await user.click(blocked)

    expect(api.requests).toEqual([])
  })

  it('stops replacing on Cancel, with focus on the Pokédex', async () => {
    onWideScreen()
    serveAsh([TEAM])
    browse([snorlax])
    const { user, router } = renderTeam(REPLACE)

    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(router.state.location.search).toBe('')
    expect(screen.queryByText('Choose a Pokémon to replace Charmander')).not.toBeInTheDocument()
    const pokedex = screen.getByRole('complementary', { name: 'Add Pokémon' })
    expect(pokedex).toHaveFocus()
    expect(await within(pokedex).findByRole('button', { name: 'Add Snorlax' })).toBeInTheDocument()
  })

  it('asks above the slots too on phones, and on Cancel there focuses the slots', async () => {
    serveAsh([TEAM])
    browse([snorlax])
    const { user, router } = renderTeam(REPLACE)

    const sheet = await screen.findByRole('dialog', { name: 'Add Pokémon' })
    await user.click(within(sheet).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Choose a Pokémon to replace Charmander')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(router.state.location.search).toBe('')
    expect(screen.getByRole('list', { name: 'Team, in battle order' })).toHaveFocus()
  })

  it('ignores a member that isn’t on the team, and takes it out of the URL', async () => {
    onWideScreen()
    serveAsh([TEAM])
    browse([snorlax])
    const { router } = renderTeam(`${EDIT}?replace=${lapras.id}`)

    const pokedex = await screen.findByRole('complementary', { name: 'Add Pokémon' })
    expect(await within(pokedex).findByRole('button', { name: 'Add Snorlax' })).toBeInTheDocument()
    expect(screen.queryByText(/Choose a Pokémon to replace/)).not.toBeInTheDocument()
    await waitFor(() => expect(router.state.location.search).toBe(''))
  })

  it('keeps the member to replace in the URL while the Pokédex is searched', async () => {
    onWideScreen()
    serveAsh([TEAM])
    browse([snorlax])
    const { user, router } = renderTeam(REPLACE)

    const pokedex = await screen.findByRole('complementary', { name: 'Add Pokémon' })
    await user.type(within(pokedex).getByRole('combobox', { name: 'Search Pokémon' }), 'snor')

    expect(new URLSearchParams(router.state.location.search).get('replace')).toBe('4')
    expect(new URLSearchParams(router.state.location.search).get('q')).toBe('snor')
    expect(screen.getByText('Choose a Pokémon to replace Charmander')).toBeInTheDocument()
  })

  it('opens the Pokédex at once on phones, asking there too, and stays open after', async () => {
    const api = serveAsh([TEAM])
    browse([snorlax])
    const { user, router } = renderTeam(REPLACE)

    const sheet = await screen.findByRole('dialog', { name: 'Add Pokémon' })
    expect(sheet).toHaveFocus()
    expect(within(sheet).getByText('Choose a Pokémon to replace Charmander')).toBeInTheDocument()
    await user.click(
      await within(sheet).findByRole('button', { name: 'Replace Charmander with Snorlax' }),
    )

    await waitFor(() => expect(memberIds(api.teams()[0])).toEqual([143, 25]))
    expect(router.state.location.search).toBe('')
    expect(screen.getByRole('dialog', { name: 'Add Pokémon' })).toBeInTheDocument()
  })

  it('stops replacing on Cancel in the sheet, with focus on the sheet', async () => {
    serveAsh([TEAM])
    browse([snorlax])
    const { user, router } = renderTeam(REPLACE)

    const sheet = await screen.findByRole('dialog', { name: 'Add Pokémon' })
    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }))

    expect(router.state.location.search).toBe('')
    expect(sheet).toHaveFocus()
    expect(await within(sheet).findByRole('button', { name: 'Add Snorlax' })).toBeInTheDocument()
  })
})
