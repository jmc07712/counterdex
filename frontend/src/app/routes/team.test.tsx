import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { type Pokemon, type Team, TeamConflictReason } from '@/api'
import { Toaster } from '@/components/layout/toaster'
import { displayName } from '@/components/pokemon/format'
import { TYPE_STYLES } from '@/components/pokemon/pokemon-types'
import {
  holdNextCurrentUser,
  holdTeamChanges,
  holdTeamFetches,
  serveCounterTeam,
  servePokemon,
  servePokemonChanges,
  servePokemonDetails,
  serveSession,
  serveTeams,
} from '@/test/handlers'
import { termsAndDefinitions } from '@/test/queries'
import { renderWithProviders } from '@/test/render'
import { server } from '@/test/server'
import { asMember, catalog, makeTeam, TEAM_ID } from '@/test/teams'
import { ASH, MISTY } from '@/test/users'

import { TeamPage } from './team'
import { TeamEditPage } from './team-edit'

const { charmander, charizard, charizardMegaX, pikachu, snorlax, gengar, lapras, eevee, vaporeon } =
  catalog
const CATALOG = Object.values(catalog)

const CHANGED_ON = '2026-10-09T09:00:00Z'

const VIEW = `/teams/${TEAM_ID}`
const EDIT = `/teams/${TEAM_ID}/edit`

function renderTeam(path = VIEW) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/teams/:teamId" element={<TeamPage />} />
        <Route path="/teams/:teamId/edit" element={<TeamEditPage />} />
        <Route path="/" element={<p>Home</p>} />
      </Routes>
      <Toaster />
    </>,
    { path },
  )
}

// Ash, signed in, with these teams.
function serveAsh(teams: Team[] = []) {
  serveSession({ signedIn: ASH })
  return serveTeams({ teams, catalog: CATALOG, signedIn: ASH })
}

// The Pokédex lists these, on one page.
function browse(pokemon: Pokemon[]) {
  return servePokemon({ items: pokemon, next_cursor: null })
}

// A screen as wide as Tailwind's lg breakpoint, where the Pokédex is beside the team.
function onWideScreen() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(min-width: 64rem)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

// The team's slots, in order. Each member's types are a list of their own, so they're left out.
function slotRows() {
  const slots = screen.getByRole('list', { name: 'Team, in battle order' })
  return within(slots)
    .getAllByRole('listitem')
    .filter((row) => row.parentElement === slots)
}

function memberIds(team: Team) {
  return team.members.map((member) => member.pokemon.id)
}

describe('TeamPage, for the team’s owner', () => {
  it('shows the owner the party, with View current in a View / Edit toggle', async () => {
    serveAsh([makeTeam({ pokemon: [charmander, pikachu] })])
    browse([])
    const { user, router } = renderTeam()

    expect(await screen.findByRole('heading', { level: 1, name: 'Team 1' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('aria-current', 'page')
    const edit = screen.getByRole('link', { name: 'Edit' })
    expect(edit).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Team actions' })).toBeInTheDocument()
    // Back to the owner's teams, as from Edit.
    expect(screen.getByRole('link', { name: 'My teams' })).toHaveAttribute('href', '/?scope=mine')
    expect(screen.queryByRole('link', { name: 'Everyone’s teams' })).not.toBeInTheDocument()
    expect(slotRows()[0]).toHaveTextContent('Lead')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove Charmander' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Build your own team' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Build a counter/ })).not.toBeInTheDocument()

    await user.click(edit)

    expect(router.state.location.pathname).toBe(EDIT)
    expect(await screen.findByRole('textbox', { name: 'Team name' })).toBeInTheDocument()
  })

  it('links the owner’s empty slots to Edit', async () => {
    serveAsh([makeTeam({ pokemon: [charmander] })])
    browse([])
    renderTeam()

    await screen.findByRole('heading', { level: 1, name: 'Team 1' })
    const rows = slotRows()
    rows.slice(1).forEach((row, index) => {
      expect(
        within(row).getByRole('link', { name: `Add Pokémon to slot ${index + 2}` }),
      ).toHaveAttribute('href', EDIT)
    })
  })

  it('offers the owner to replace each member removed from the Pokédex', async () => {
    const removed = '2026-10-11T09:00:00Z'
    serveAsh([
      makeTeam({
        members: [
          { ...asMember(charmander, 0), removed_at: removed },
          asMember(pikachu, 1),
          { ...asMember(snorlax, 2), removed_at: removed },
        ],
      }),
    ])
    browse([])
    renderTeam()

    await screen.findByRole('heading', { level: 1, name: 'Team 1' })
    const rows = slotRows()
    expect(rows[0]).toHaveTextContent('Removed from PokéAPI on Oct 11, 2026')
    expect(within(rows[0]).getByRole('link', { name: 'Replace Charmander' })).toHaveAttribute(
      'href',
      `${EDIT}?replace=4`,
    )
    expect(within(rows[1]).queryByRole('link', { name: /Replace/ })).not.toBeInTheDocument()
    expect(within(rows[2]).getByRole('link', { name: 'Replace Snorlax' })).toHaveAttribute(
      'href',
      `${EDIT}?replace=143`,
    )
  })

  it('edits the team on its Edit page, with Edit current in the toggle', async () => {
    serveAsh([makeTeam({ pokemon: [charmander] })])
    browse([])
    const { user, router } = renderTeam(EDIT)

    expect(await screen.findByRole('textbox', { name: 'Team name' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('aria-current', 'page')
    const view = screen.getByRole('link', { name: 'View' })
    expect(view).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Team actions' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My teams' })).toHaveAttribute('href', '/?scope=mine')

    await user.click(view)

    expect(router.state.location.pathname).toBe(VIEW)
    expect(await screen.findByText('Lead')).toBeInTheDocument()
  })

  it('shows the team’s name as the page’s heading, and its six slots', async () => {
    serveAsh([makeTeam({ pokemon: [charmander] })])
    browse([])

    renderTeam(EDIT)

    expect(await screen.findByRole('heading', { level: 1, name: 'Team 1' })).toBeInTheDocument()
    const rows = slotRows()
    expect(rows).toHaveLength(6)
    expect(rows[0]).toHaveTextContent('Charmander')
    expect(within(rows[0]).getByRole('button', { name: 'Remove Charmander' })).toBeInTheDocument()
    expect(rows.slice(1).map((row) => row.textContent)).toEqual(
      ['2', '3', '4', '5', '6'].map((number) => `${number}Empty slot`),
    )
  })

  it('paints each member’s slot in its main type, and one no longer in the Pokédex in neither', async () => {
    serveAsh([
      makeTeam({
        members: [
          asMember(charizard, 0),
          { ...asMember(pikachu, 1), removed_at: '2026-10-11T09:00:00Z' },
        ],
      }),
    ])
    browse([])

    renderTeam(EDIT)

    await screen.findByRole('heading', { level: 1, name: 'Team 1' })
    const [charizardSlot, pikachuSlot] = slotRows()
    expect(charizardSlot).toHaveStyle({
      backgroundColor: TYPE_STYLES.fire.background,
      color: TYPE_STYLES.fire.foreground,
    })
    expect(within(charizardSlot).getByRole('list', { name: 'Types' })).toHaveTextContent(
      'FireFlying',
    )
    expect(pikachuSlot).not.toHaveStyle({ backgroundColor: TYPE_STYLES.electric.background })
    expect(pikachuSlot).toHaveTextContent('Removed from PokéAPI on Oct 11, 2026')
    expect(within(pikachuSlot).queryByRole('list', { name: 'Types' })).not.toBeInTheDocument()
    expect(within(pikachuSlot).getByRole('button', { name: 'Remove Pikachu' })).toBeInTheDocument()
  })

  it('says above the slots it edits which members a sync changed this week', async () => {
    serveAsh([makeTeam({ pokemon: [{ ...charizard, changed_recently: true }, pikachu] })])
    browse([])
    servePokemonChanges()

    renderTeam(EDIT)

    const line = await screen.findByText('Charizard changed this week')
    const slots = screen.getByRole('list', { name: 'Team, in battle order' })
    expect(line.compareDocumentPosition(slots)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('adds a Pokémon from the Pokédex beside the team, and says so', async () => {
    onWideScreen()
    const api = serveAsh([makeTeam({ pokemon: [charmander] })])
    browse([pikachu, snorlax])
    const { user } = renderTeam(EDIT)

    const pokedex = await screen.findByRole('complementary', { name: 'Add Pokémon' })
    await user.click(await within(pokedex).findByRole('button', { name: 'Add Pikachu' }))

    await waitFor(() => expect(memberIds(api.teams()[0])).toEqual([4, 25]))
    const toast = (await screen.findByText('Added Pikachu to Team 1')).closest('li')!
    // The team is in view beside the Pokédex, so the toast has nothing to press.
    expect(within(toast).queryByRole('button')).not.toBeInTheDocument()
    expect(slotRows()[1]).toHaveTextContent('Pikachu')
    expect(within(pokedex).getByRole('button', { name: 'Add Snorlax' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Pokémon' })).not.toBeInTheDocument()
  })

  it('opens the Pokédex in a sheet on phones, focused itself rather than its search', async () => {
    serveAsh([makeTeam({ pokemon: [charmander] })])
    browse([pikachu])
    const { user } = renderTeam(EDIT)

    expect(await screen.findByRole('heading', { level: 1, name: 'Team 1' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Add Pokémon' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add Pokémon' }))

    const sheet = await screen.findByRole('dialog', { name: 'Add Pokémon' })
    expect(sheet).toHaveAttribute('data-slot', 'sheet-content')
    expect(sheet).toHaveFocus()
    expect(within(sheet).getByRole('combobox', { name: 'Search Pokémon' })).not.toHaveFocus()
    expect(await within(sheet).findByRole('article', { name: 'Pikachu' })).toBeInTheDocument()
  })

  it('marks its floating button on phones, so toasts keep clear of it', async () => {
    serveAsh([makeTeam({ pokemon: [charmander] })])
    browse([])

    renderTeam(EDIT)

    expect(await screen.findByRole('button', { name: 'Add Pokémon' })).toHaveAttribute(
      'data-floating-button',
    )
  })

  it('adds from the sheet on phones, which stays open to add another', async () => {
    const api = serveAsh([makeTeam({ pokemon: [charmander] })])
    browse([pikachu, snorlax])
    const { user } = renderTeam(EDIT)

    await user.click(await screen.findByRole('button', { name: 'Add Pokémon' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add Pokémon' })
    await user.click(await within(sheet).findByRole('button', { name: 'Add Pikachu' }))
    await user.click(within(sheet).getByRole('button', { name: 'Add Snorlax' }))

    await waitFor(() => expect(memberIds(api.teams()[0])).toEqual([4, 25, 143]))
    expect(screen.getByRole('dialog', { name: 'Add Pokémon' })).toBeInTheDocument()
  })

  it('closes the sheet with Done, to show the team', async () => {
    serveAsh([makeTeam({ pokemon: [charmander] })])
    browse([pikachu])
    const { user } = renderTeam(EDIT)

    await user.click(await screen.findByRole('button', { name: 'Add Pokémon' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add Pokémon' })
    await user.click(await within(sheet).findByRole('button', { name: 'Add Pikachu' }))
    await user.click(within(sheet).getByRole('button', { name: 'Done' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add Pokémon' })).not.toBeInTheDocument(),
    )
    expect(slotRows()[1]).toHaveTextContent('Pikachu')
  })

  it('keeps focus on a card’s button as it adds the Pokémon, and then says it’s on the team', async () => {
    onWideScreen()
    const api = serveAsh([makeTeam({ pokemon: [charmander] })])
    browse([pikachu])
    const { user, queryClient } = renderTeam(EDIT)

    const pokedex = await screen.findByRole('complementary', { name: 'Add Pokémon' })
    const button = await within(pokedex).findByRole('button', { name: 'Add Pikachu' })
    await user.click(button)

    await waitFor(() => expect(memberIds(api.teams()[0])).toEqual([4, 25]))
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(button).toHaveAccessibleName('Pikachu is on the team')
    expect(button).toHaveTextContent('On the team')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveFocus()
  })

  it('says a Pokémon on the team is on it, with nothing to press', async () => {
    onWideScreen()
    const api = serveAsh([makeTeam({ pokemon: [charmander] })])
    browse([charmander])
    const { user } = renderTeam(EDIT)

    const pokedex = await screen.findByRole('complementary', { name: 'Add Pokémon' })
    const card = await within(pokedex).findByRole('article', { name: 'Charmander' })
    const button = within(card).getByRole('button', { name: 'Charmander is on the team' })
    await user.click(button)

    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(api.requests).toEqual([])
  })

  it.each([
    ['a later stage', charizard],
    ['another form of a later stage', charizardMegaX],
  ])(
    'offers to replace the member from a Pokémon’s family on the team: %s',
    async (_, pokemon) => {
      onWideScreen()
      const api = serveAsh([makeTeam({ pokemon: [charmander, pikachu] })])
      browse([pokemon])
      const { user } = renderTeam(EDIT)

      const name = displayName(pokemon.name)
      const pokedex = await screen.findByRole('complementary', { name: 'Add Pokémon' })
      const card = await within(pokedex).findByRole('article', { name })
      const button = within(card).getByRole('button', { name: `Replace Charmander with ${name}` })
      expect(button).toHaveTextContent('Replace Charmander')
      expect(button).toHaveAccessibleDescription('Charmander’s family is on the team')
      expect(within(card).queryByRole('button', { name: /Add/ })).not.toBeInTheDocument()

      await user.click(button)

      await waitFor(() => expect(memberIds(api.teams()[0])).toEqual([pokemon.id, 25]))
      expect(api.requests).toEqual([
        {
          method: 'PUT',
          path: `/api/teams/${TEAM_ID}/members/${charmander.id}`,
          body: { pokemon_id: pokemon.id },
        },
      ])
    },
  )

  it('replaces the member from a Pokémon’s family when that member isn’t the lead', async () => {
    onWideScreen()
    const api = serveAsh([makeTeam({ pokemon: [pikachu, charmander] })])
    browse([charizard])
    const { user } = renderTeam(EDIT)

    const pokedex = await screen.findByRole('complementary', { name: 'Add Pokémon' })
    await user.click(
      await within(pokedex).findByRole('button', { name: 'Replace Charmander with Charizard' }),
    )

    await waitFor(() => expect(memberIds(api.teams()[0])).toEqual([25, 6]))
    expect(api.requests).toEqual([
      { method: 'PUT', path: `/api/teams/${TEAM_ID}/members/4`, body: { pokemon_id: 6 } },
    ])
  })

  it('keeps focus on a card’s button in the sheet as it replaces a member', async () => {
    const api = serveAsh([makeTeam({ pokemon: [charmander, pikachu] })])
    browse([charizard])
    const { user, queryClient } = renderTeam(EDIT)

    await user.click(await screen.findByRole('button', { name: 'Add Pokémon' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add Pokémon' })
    const button = await within(sheet).findByRole('button', {
      name: 'Replace Charmander with Charizard',
    })
    await user.click(button)

    await waitFor(() => expect(memberIds(api.teams()[0])).toEqual([6, 25]))
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(button).toHaveAccessibleName('Charizard is on the team')
    expect(button).toHaveFocus()
  })

  it('says when the team is full, with nothing to add, but still offers to replace', async () => {
    onWideScreen()
    const api = serveAsh([
      makeTeam({ pokemon: [charmander, pikachu, snorlax, gengar, eevee, lapras] }),
    ])
    browse([catalog.dragonite, charizard])
    const { user } = renderTeam(EDIT)

    const pokedex = await screen.findByRole('complementary', { name: 'Add Pokémon' })
    const dragonite = await within(pokedex).findByRole('article', { name: 'Dragonite' })
    const full = within(dragonite).getByRole('button', { name: 'Team is full' })
    await user.click(full)

    expect(full).toHaveAttribute('aria-disabled', 'true')
    expect(api.requests).toEqual([])
    const charizardCard = within(pokedex).getByRole('article', { name: 'Charizard' })
    expect(
      within(charizardCard).getByRole('button', { name: 'Replace Charmander with Charizard' }),
    ).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('searches and filters the Pokédex beside the team, keeping the filters in the URL', async () => {
    onWideScreen()
    serveAsh([makeTeam()])
    const requests = browse([pikachu])
    const { user, router } = renderTeam(EDIT)

    const pokedex = await screen.findByRole('complementary', { name: 'Add Pokémon' })
    await user.type(within(pokedex).getByRole('combobox', { name: 'Search Pokémon' }), 'pika')
    await user.click(within(pokedex).getByRole('button', { name: 'Electric' }))

    // Leaving out the search suggestions' requests, which ask for a few.
    await waitFor(() =>
      expect(requests.filter((query) => !query.includes('limit=')).at(-1)).toBe(
        'q=pika&type=electric',
      ),
    )
    expect(router.state.location.search).toBe('?q=pika&type=electric')
  })

  it('loads more Pokémon as the end of the Pokédex scrolls into view', async () => {
    onWideScreen()
    serveAsh([makeTeam()])
    servePokemon((query) =>
      query.has('cursor')
        ? { items: [snorlax], next_cursor: null }
        : { items: [pikachu], next_cursor: 25 },
    )
    renderTeam(EDIT)
    const pokedex = await screen.findByRole('complementary', { name: 'Add Pokémon' })
    await within(pokedex).findByRole('article', { name: 'Pikachu' })

    mockAllIsIntersecting(true)

    expect(await within(pokedex).findByRole('article', { name: 'Snorlax' })).toBeInTheDocument()
  })

  it('opens a Pokémon’s details from its card in the Pokédex', async () => {
    onWideScreen()
    serveAsh([makeTeam()])
    browse([charizard])
    servePokemonDetails()
    servePokemonChanges()
    const { user, router } = renderTeam(EDIT)

    const pokedex = await screen.findByRole('complementary', { name: 'Add Pokémon' })
    await user.click(await within(pokedex).findByRole('button', { name: 'Charizard' }))

    expect(await screen.findByRole('dialog', { name: 'Charizard' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?pokemon=6')
  })

  it('opens a member’s details from its slot', async () => {
    serveAsh([makeTeam({ pokemon: [charmander, charizard] })])
    browse([])
    servePokemonDetails()
    servePokemonChanges()
    const { user, router } = renderTeam(EDIT)

    await screen.findByRole('heading', { level: 1, name: 'Team 1' })
    await user.click(within(slotRows()[1]).getByRole('button', { name: 'Charizard' }))

    expect(await screen.findByRole('dialog', { name: 'Charizard' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?pokemon=6')
  })

  it('removes a Pokémon at once, before the API answers', async () => {
    const api = serveAsh([makeTeam({ pokemon: [charmander, pikachu] })])
    browse([])
    const hold = holdTeamChanges()
    const { user } = renderTeam(EDIT)

    await user.click(await screen.findByRole('button', { name: 'Remove Charmander' }))

    expect(screen.queryByText('Charmander')).not.toBeInTheDocument()
    hold.release()
    await waitFor(() => expect(api.teams()[0].members).toHaveLength(1))
  })

  it('sends changes to a team one at a time, in order', async () => {
    const api = serveAsh([makeTeam({ pokemon: [charmander, pikachu] })])
    browse([])
    const hold = holdTeamChanges()
    const { user } = renderTeam(EDIT)

    await user.click(await screen.findByRole('button', { name: 'Remove Charmander' }))
    await user.click(screen.getByRole('button', { name: 'Remove Pikachu' }))
    await waitFor(() => expect(hold.arrived()).toBe(1))
    // Given time, the second still hasn't been sent: it waits for the first, which is held.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(hold.arrived()).toBe(1)

    hold.release()

    await waitFor(() => expect(api.teams()[0].members).toEqual([]))
    expect(api.requests.map((request) => request.path)).toEqual([
      `/api/teams/${TEAM_ID}/members/4`,
      `/api/teams/${TEAM_ID}/members/25`,
    ])
  })

  it('undoes a change the API refuses, and says why', async () => {
    serveAsh([makeTeam({ pokemon: [charmander] })])
    browse([])
    server.use(
      http.delete('/api/teams/:teamId/members/:pokemonId', () =>
        HttpResponse.json(
          { detail: 'Refused.', reason: TeamConflictReason.ORDER_OUT_OF_DATE },
          { status: 409 },
        ),
      ),
    )
    const { user } = renderTeam(EDIT)
    const remove = await screen.findByRole('button', { name: 'Remove Charmander' })
    // Held, so what shows is the change undone rather than the team fetched again.
    const fetches = holdTeamFetches()

    await user.click(remove)

    expect(
      await screen.findByText('This team changed somewhere else, so it’s been reloaded.'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Charmander')).toBeInTheDocument()
    fetches.release()
  })

  it('renames on Enter, and puts back a blank name', async () => {
    const api = serveAsh([makeTeam()])
    browse([])
    const { user } = renderTeam(EDIT)

    const name = await screen.findByRole('textbox', { name: 'Team name' })
    await user.clear(name)
    await user.type(name, '   {Enter}')
    expect(name).toHaveValue('Team 1')
    expect(api.requests).toHaveLength(0)

    await user.clear(name)
    await user.type(name, 'Rain{Enter}')
    await waitFor(() => expect(api.teams()[0].name).toBe('Rain'))
    expect(api.requests).toEqual([
      { method: 'PATCH', path: `/api/teams/${TEAM_ID}`, body: { name: 'Rain' } },
    ])
  })

  it('stops a name at 40 characters', async () => {
    serveAsh([makeTeam()])
    browse([])
    renderTeam(EDIT)

    expect(await screen.findByRole('textbox', { name: 'Team name' })).toHaveAttribute(
      'maxlength',
      '40',
    )
  })

  it('deletes after you confirm, then goes to your teams', async () => {
    const api = serveAsh([makeTeam()])
    browse([])
    const { user, router } = renderTeam(EDIT)

    await user.click(await screen.findByRole('button', { name: 'Team actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete team' }))
    await user.click(await screen.findByRole('button', { name: 'Delete team' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(router.state.location.search).toBe('?scope=mine')
    expect(api.teams()).toEqual([])
  })

  it('keeps the team if you don’t confirm, with focus back on its menu', async () => {
    const api = serveAsh([makeTeam()])
    browse([])
    const { user } = renderTeam(EDIT)

    const menu = await screen.findByRole('button', { name: 'Team actions' })
    await user.click(menu)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete team' }))
    await user.click(await screen.findByRole('button', { name: 'Keep it' }))

    await waitFor(() => expect(menu).toHaveFocus())
    expect(api.requests).toHaveLength(0)
  })
})

describe('TeamPage, choosing a Pokémon to replace a member', () => {
  const REMOVED_ON = '2026-10-11T09:00:00Z'
  // Charmander was removed from the Pokédex.
  const TEAM = makeTeam({
    members: [{ ...asMember(charmander, 0), removed_at: REMOVED_ON }, asMember(pikachu, 1)],
  })
  const REPLACE = `${EDIT}?replace=${charmander.id}`

  it('asks for a Pokémon to replace the member, and replaces it with the one chosen', async () => {
    onWideScreen()
    const api = serveAsh([TEAM])
    browse([pikachu, snorlax])
    const { user, router, queryClient } = renderTeam(REPLACE)

    expect(await screen.findByText('Choose a Pokémon to replace Charmander')).toBeInTheDocument()
    const pokedex = screen.getByRole('complementary', { name: 'Add Pokémon' })
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

  it('asks above the Pokédex beside the team, rather than in the team’s column', async () => {
    onWideScreen()
    serveAsh([TEAM])
    browse([snorlax])
    renderTeam(REPLACE)

    const pokedex = await screen.findByRole('complementary', { name: 'Add Pokémon' })
    expect(within(pokedex).getByText('Choose a Pokémon to replace Charmander')).toBeInTheDocument()
    expect(screen.getAllByText('Choose a Pokémon to replace Charmander')).toHaveLength(1)
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

describe.each([
  ['someone else', MISTY],
  ['someone signed out', null],
])('TeamPage, for %s', (_, viewer) => {
  it.each([
    ['its page', VIEW],
    ['its Edit page', EDIT],
  ])(
    'shows the team as it is on %s, by its owner, with nothing to change it',
    async (_page, path) => {
      onWideScreen()
      serveSession({ signedIn: viewer })
      serveTeams({ teams: [makeTeam({ pokemon: [charmander, pikachu] })], catalog: CATALOG })

      renderTeam(path)

      expect(await screen.findByRole('heading', { level: 1, name: 'Team 1' })).toBeInTheDocument()
      expect(screen.getByText('by ash')).toBeInTheDocument()
      const rows = slotRows()
      expect(rows).toHaveLength(6)
      expect(rows[0]).toHaveTextContent('Charmander')
      expect(screen.getByRole('link', { name: 'Build your own team' })).toHaveAttribute(
        'href',
        '/?scope=mine',
      )
      expect(screen.getByRole('link', { name: 'Everyone’s teams' })).toHaveAttribute('href', '/')
      expect(screen.queryByRole('link', { name: 'My teams' })).not.toBeInTheDocument()
      // Besides building a counter to the team, each member opens its details, and that's all
      // there is to press.
      expect(
        screen.getAllByRole('button', { name: (name) => name !== 'Build a counter to Team 1' }),
      ).toEqual([
        screen.getByRole('button', { name: 'Charmander' }),
        screen.getByRole('button', { name: 'Pikachu' }),
      ])
      expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /Add Pokémon to slot/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    },
  )
})

describe('TeamPage, to counter someone else’s team', () => {
  it('builds a counter from beside the team’s name, then opens it to edit', async () => {
    serveSession({ signedIn: MISTY })
    const api = serveTeams({
      teams: [makeTeam({ pokemon: [charmander, pikachu] })],
      catalog: CATALOG,
      signedIn: MISTY,
    })
    const counters = serveCounterTeam({ catalog: [lapras, snorlax, gengar] })
    browse([])
    const { user, router } = renderTeam()

    await screen.findByRole('heading', { level: 1, name: 'Team 1' })
    await user.click(screen.getByRole('button', { name: 'Build a counter to Team 1' }))

    expect(await screen.findByRole('textbox', { name: 'Team name' })).toHaveValue(
      'Counter to Team 1',
    )
    expect(router.state.location.pathname).toMatch(/^\/teams\/[0-9a-f-]{36}\/edit$/)
    expect(counters).toEqual([`pokemon_id=${charmander.id}&pokemon_id=${pikachu.id}`])
    expect(memberIds(api.teams()[0])).toEqual([lapras.id, snorlax.id])
  })

  it('links someone signed out to signing in first, then back to the team', async () => {
    serveSession()
    serveTeams({ teams: [makeTeam({ pokemon: [charmander] })], catalog: CATALOG })

    renderTeam()

    expect(await screen.findByRole('link', { name: 'Build a counter to Team 1' })).toHaveAttribute(
      'href',
      `/sign-in?next=${encodeURIComponent(VIEW)}`,
    )
  })

  it('offers no counter to a team with no Pokémon', async () => {
    serveSession({ signedIn: MISTY })
    serveTeams({ teams: [makeTeam()], catalog: CATALOG })

    renderTeam()

    await screen.findByRole('heading', { level: 1, name: 'Team 1' })
    expect(screen.queryByRole('button', { name: /Build a counter/ })).not.toBeInTheDocument()
  })
})

describe('TeamPage, as a party', () => {
  it('shows the lead in a slot of its own, then the rest in battle order', async () => {
    serveSession()
    serveTeams({ teams: [makeTeam({ pokemon: [charizard, pikachu, gengar] })], catalog: CATALOG })

    renderTeam()

    await screen.findByRole('heading', { level: 1, name: 'Team 1' })
    expect(screen.getByText('3 of 6')).toBeInTheDocument()
    // Each catalog Pokémon's base stats add up to 540.
    const power = screen.getByRole('meter', { name: 'Team power' })
    expect(power).toHaveAttribute('aria-valuetext', '1,620')
    expect(power).toHaveAttribute('aria-valuenow', '1620')
    expect(power).toHaveAttribute('aria-valuemax', '4320')
    expect(power).toHaveAccessibleDescription('The sum of its Pokémon’s base stats')
    const rows = slotRows()
    expect(rows).toHaveLength(6)
    expect(rows[0]).toHaveTextContent('Lead')
    expect(within(rows[0]).getByRole('heading', { level: 2 })).toHaveTextContent('Charizard')
    expect(rows[0]).toHaveTextContent('No. 0006')
    expect(rows[0]).toHaveStyle({ backgroundColor: TYPE_STYLES.fire.background })
    expect(termsAndDefinitions(rows[0])).toEqual([
      ['HP', '95'],
      ['Attack', '125'],
      ['Defense', '79'],
      ['Sp. Atk', '60'],
      ['Sp. Def', '100'],
      ['Speed', '81'],
      ['Total', '540'],
    ])
    expect(termsAndDefinitions(rows[1])).toContainEqual(['Total', '540'])
    expect(rows.slice(1, 3).map((row) => within(row).getByRole('heading').textContent)).toEqual([
      'Pikachu',
      'Gengar',
    ])
    expect(rows.slice(1).map((row) => row.textContent?.includes('Lead'))).not.toContain(true)
  })

  it('shows its empty slots, and when a member was removed from the Pokédex', async () => {
    serveSession()
    serveTeams({
      teams: [
        makeTeam({
          members: [
            asMember(charmander, 0),
            { ...asMember(pikachu, 1), removed_at: '2026-10-11T09:00:00Z' },
          ],
        }),
      ],
      catalog: CATALOG,
    })

    renderTeam()

    await screen.findByRole('heading', { level: 1, name: 'Team 1' })
    const rows = slotRows()
    expect(rows[1]).toHaveTextContent('Removed from PokéAPI on Oct 11, 2026')
    expect(within(rows[1]).queryByRole('list', { name: 'Types' })).not.toBeInTheDocument()
    expect(rows[1]).not.toHaveStyle({ backgroundColor: TYPE_STYLES.electric.background })
    // Its last known stats stay.
    expect(termsAndDefinitions(rows[1])).toContainEqual(['Total', '540'])
    // Only its owner can replace it.
    expect(within(rows[1]).queryByRole('link', { name: /Replace/ })).not.toBeInTheDocument()
    for (const row of rows.slice(2)) {
      expect(row).toHaveTextContent('Empty slot')
      expect(within(row).queryByRole('link')).not.toBeInTheDocument()
    }
  })

  it('says above its members which of them a sync changed this week', async () => {
    serveSession()
    servePokemonChanges()
    serveTeams({
      teams: [
        makeTeam({
          pokemon: [
            charizard,
            { ...pikachu, changed_recently: true },
            { ...gengar, changed_recently: true },
          ],
        }),
      ],
      catalog: CATALOG,
    })

    renderTeam()

    const line = await screen.findByText('Pikachu and Gengar changed this week')
    const slots = screen.getByRole('list', { name: 'Team, in battle order' })
    expect(line.compareDocumentPosition(slots)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('asks for the changes of only the members a sync changed, and still in the Pokédex', async () => {
    serveSession()
    serveTeams({
      teams: [
        makeTeam({
          members: [
            asMember(charmander, 0),
            asMember({ ...pikachu, changed_recently: true }, 1),
            { ...asMember({ ...gengar, changed_recently: true }, 2), removed_at: CHANGED_ON },
            asMember({ ...snorlax, changed_recently: true }, 3),
          ],
        }),
      ],
      catalog: CATALOG,
    })
    // Each was renamed.
    const asked = servePokemonChanges((id) =>
      CATALOG.filter((each) => each.id === id).map((after) => ({
        kind: 'updated',
        detected_at: CHANGED_ON,
        before: { ...after, name: 'old-name' },
        after,
      })),
    )

    renderTeam()

    await screen.findByText('Pikachu, Gengar and 1 more changed this week')
    const rows = slotRows()
    await waitFor(() => expect(rows[1]).toHaveTextContent('Name Old Name → Pikachu'))
    expect(rows[3]).toHaveTextContent('Name Old Name → Snorlax')
    expect(asked.toSorted((one, other) => one - other)).toEqual([25, 143])
  })

  it('says nothing changed this week when no sync changed a member', async () => {
    serveSession()
    serveTeams({ teams: [makeTeam({ pokemon: [charizard, pikachu] })], catalog: CATALOG })

    renderTeam()

    await screen.findByRole('heading', { level: 1, name: 'Team 1' })
    expect(screen.queryByText(/changed this week/)).not.toBeInTheDocument()
  })

  it('opens a member’s Pokédex details from its slot, and puts it in the URL', async () => {
    serveSession()
    serveTeams({ teams: [makeTeam({ pokemon: [charmander, charizard] })], catalog: CATALOG })
    servePokemonDetails()
    servePokemonChanges()
    const { user, router } = renderTeam()

    await user.click(await screen.findByRole('button', { name: 'Charizard' }))

    expect(await screen.findByRole('dialog', { name: 'Charizard' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?pokemon=6')
  })
})

describe('TeamPage, while it’s not yet known who’s signed in', () => {
  it('shows neither the party nor the builder on the Edit page', async () => {
    serveAsh([makeTeam({ pokemon: [charmander] })])
    browse([])
    const release = holdNextCurrentUser(ASH)
    renderTeam(EDIT)

    // Given time, the team has loaded, but who's signed in is held.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Build your own team' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    release()

    expect(await screen.findByRole('textbox', { name: 'Team name' })).toBeInTheDocument()
  })
})

describe('TeamPage, for anyone', () => {
  it('says when a team doesn’t exist', async () => {
    serveAsh()

    renderTeam()

    expect(await screen.findByText('This team doesn’t exist')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the Teams page' })).toHaveAttribute('href', '/')
  })

  it('says when the team couldn’t load, and tries again', async () => {
    serveSession()
    let fetches = 0
    server.use(
      http.get('/api/teams/:teamId', () => {
        fetches += 1
        return HttpResponse.json({ detail: 'Refused.' }, { status: 500 })
      }),
    )
    const { user } = renderTeam()

    expect(await screen.findByText('Couldn’t load this team')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(fetches).toBe(2))
  })
})
