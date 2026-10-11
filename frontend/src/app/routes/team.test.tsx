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
  holdTeamChanges,
  holdTeamFetches,
  servePokemon,
  servePokemonChanges,
  servePokemonDetails,
  serveSession,
  serveTeams,
} from '@/test/handlers'
import { renderWithProviders } from '@/test/render'
import { server } from '@/test/server'
import { asMember, catalog, makeTeam, TEAM_ID } from '@/test/teams'
import { ASH, MISTY } from '@/test/users'

import { TeamPage } from './team'
import { TeamEditPage } from './team-edit'

const { charmander, charizard, charizardMegaX, pikachu, snorlax, gengar, lapras, eevee } = catalog
const CATALOG = Object.values(catalog)

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

// The Pokémon browser lists these, on one page.
function browse(pokemon: Pokemon[]) {
  return servePokemon({ items: pokemon, next_cursor: null })
}

// A screen as wide as Tailwind's lg breakpoint, where the builder has two panes.
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
    expect(slotRows()[0]).toHaveTextContent('Lead')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove Charmander' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Build your own team' })).not.toBeInTheDocument()

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

  it('edits the team on its Edit page, with Edit current in the toggle', async () => {
    serveAsh([makeTeam({ pokemon: [charmander] })])
    browse([])
    const { user, router } = renderTeam(EDIT)

    expect(await screen.findByRole('textbox', { name: 'Team name' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('aria-current', 'page')
    const view = screen.getByRole('link', { name: 'View' })
    expect(view).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Team actions' })).toBeInTheDocument()

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
    expect(pikachuSlot).toHaveTextContent('No longer in the Pokédex')
    expect(within(pikachuSlot).queryByRole('list', { name: 'Types' })).not.toBeInTheDocument()
    expect(within(pikachuSlot).getByRole('button', { name: 'Remove Pikachu' })).toBeInTheDocument()
  })

  it('adds a Pokémon from the browser beside the team, which stays open', async () => {
    onWideScreen()
    const api = serveAsh([makeTeam({ pokemon: [charmander] })])
    browse([pikachu, snorlax])
    const { user } = renderTeam(EDIT)

    const browser = await screen.findByRole('complementary', { name: 'Add Pokémon' })
    await user.click(await within(browser).findByRole('button', { name: 'Add Pikachu' }))

    await waitFor(() => expect(memberIds(api.teams()[0])).toEqual([4, 25]))
    expect(await screen.findByText('Added Pikachu to Team 1')).toBeInTheDocument()
    // The team is already in view beside the browser.
    expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument()
    expect(within(browser).getByText('Its family is on the team')).toBeInTheDocument()
    expect(within(browser).getByRole('button', { name: 'Add Snorlax' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Pokémon' })).not.toBeInTheDocument()
  })

  it('adds from a sheet on phones, which stays open to add another', async () => {
    const api = serveAsh([makeTeam({ pokemon: [charmander] })])
    browse([pikachu, snorlax])
    const { user } = renderTeam(EDIT)

    expect(screen.queryByRole('complementary', { name: 'Add Pokémon' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Add Pokémon' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add Pokémon' })
    expect(sheet).toHaveAttribute('data-slot', 'sheet-content')
    await user.click(await within(sheet).findByRole('button', { name: 'Add Pikachu' }))
    await user.click(within(sheet).getByRole('button', { name: 'Add Snorlax' }))

    await waitFor(() => expect(memberIds(api.teams()[0])).toEqual([4, 25, 143]))
    expect(screen.getByRole('dialog', { name: 'Add Pokémon' })).toBeInTheDocument()
  })

  it('closes the sheet to show the team from the toast’s View', async () => {
    serveAsh([makeTeam({ pokemon: [charmander] })])
    browse([pikachu])
    const { user } = renderTeam(EDIT)

    await user.click(await screen.findByRole('button', { name: 'Add Pokémon' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add Pokémon' })
    await user.click(await within(sheet).findByRole('button', { name: 'Add Pikachu' }))
    await user.click(await screen.findByRole('button', { name: 'View' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add Pokémon' })).not.toBeInTheDocument(),
    )
    expect(slotRows()[1]).toHaveTextContent('Pikachu')
  })

  it.each([
    ['a later stage', charizard],
    ['another form of a later stage', charizardMegaX],
  ])(
    'says why a Pokémon from a family on the team can’t be added, in place of its Add button: %s',
    async (_, pokemon) => {
      onWideScreen()
      serveAsh([makeTeam({ pokemon: [charmander] })])
      browse([pokemon])
      renderTeam(EDIT)

      const browser = await screen.findByRole('complementary', { name: 'Add Pokémon' })
      const row = (await within(browser).findByText(displayName(pokemon.name))).closest('li')

      expect(row).toHaveTextContent('Its family is on the team')
      expect(within(row!).queryByRole('button')).not.toBeInTheDocument()
    },
  )

  it('says when the team is full', async () => {
    onWideScreen()
    serveAsh([makeTeam({ pokemon: [charmander, pikachu, snorlax, gengar, eevee, lapras] })])
    browse([catalog.dragonite])
    renderTeam(EDIT)

    const browser = await screen.findByRole('complementary', { name: 'Add Pokémon' })
    const row = (await within(browser).findByText('Dragonite')).closest('li')

    expect(row).toHaveTextContent('Team is full')
    expect(within(row!).queryByRole('button')).not.toBeInTheDocument()
  })

  it('searches and filters the browser by type', async () => {
    onWideScreen()
    serveAsh([makeTeam()])
    const requests = browse([pikachu])
    const { user } = renderTeam(EDIT)

    const browser = await screen.findByRole('complementary', { name: 'Add Pokémon' })
    await user.type(within(browser).getByRole('searchbox', { name: 'Search Pokémon' }), 'pika')
    await user.click(within(browser).getByRole('button', { name: 'Electric' }))

    await waitFor(() => expect(requests.at(-1)).toBe('q=pika&type=electric'))
  })

  it('loads more Pokémon as the end of the browser’s list scrolls into view', async () => {
    onWideScreen()
    serveAsh([makeTeam()])
    servePokemon((query) =>
      query.has('cursor')
        ? { items: [snorlax], next_cursor: null }
        : { items: [pikachu], next_cursor: 25 },
    )
    renderTeam(EDIT)
    const browser = await screen.findByRole('complementary', { name: 'Add Pokémon' })
    await within(browser).findByText('Pikachu')

    mockAllIsIntersecting(true)

    expect(await within(browser).findByText('Snorlax')).toBeInTheDocument()
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

  it('deletes after you confirm, then goes home', async () => {
    const api = serveAsh([makeTeam()])
    browse([])
    const { user, router } = renderTeam(EDIT)

    await user.click(await screen.findByRole('button', { name: 'Team actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete team' }))
    await user.click(await screen.findByRole('button', { name: 'Delete team' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
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
      expect(screen.getByRole('link', { name: 'Build your own team' })).toHaveAttribute('href', '/')
      expect(screen.getByRole('link', { name: 'Explore teams' })).toHaveAttribute('href', '/explore')
      // Each member opens its details, and that's all there is to press.
      expect(screen.getAllByRole('button')).toEqual([
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

describe('TeamPage, as a party', () => {
  it('shows the lead in a slot of its own, then the rest in battle order', async () => {
    serveSession()
    serveTeams({ teams: [makeTeam({ pokemon: [charizard, pikachu, gengar] })], catalog: CATALOG })

    renderTeam()

    await screen.findByRole('heading', { level: 1, name: 'Team 1' })
    expect(screen.getByText('3 of 6')).toBeInTheDocument()
    const rows = slotRows()
    expect(rows).toHaveLength(6)
    expect(rows[0]).toHaveTextContent('Lead')
    expect(within(rows[0]).getByRole('heading', { level: 2 })).toHaveTextContent('Charizard')
    expect(rows[0]).toHaveTextContent('No. 0006')
    expect(rows[0]).toHaveStyle({ backgroundColor: TYPE_STYLES.fire.background })
    expect(rows.slice(1, 3).map((row) => within(row).getByRole('heading').textContent)).toEqual([
      'Pikachu',
      'Gengar',
    ])
    expect(rows.slice(1).map((row) => row.textContent?.includes('Lead'))).not.toContain(true)
  })

  it('shows its empty slots, and a member no longer in the Pokédex', async () => {
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
    expect(rows[1]).toHaveTextContent('No longer in the Pokédex')
    expect(within(rows[1]).queryByRole('list', { name: 'Types' })).not.toBeInTheDocument()
    expect(rows[1]).not.toHaveStyle({ backgroundColor: TYPE_STYLES.electric.background })
    for (const row of rows.slice(2)) {
      expect(row).toHaveTextContent('Empty slot')
      expect(within(row).queryByRole('link')).not.toBeInTheDocument()
    }
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

describe('TeamPage, for anyone', () => {
  it('says when a team doesn’t exist', async () => {
    serveAsh()

    renderTeam()

    expect(await screen.findByText('This team doesn’t exist')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All teams' })).toHaveAttribute('href', '/')
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
