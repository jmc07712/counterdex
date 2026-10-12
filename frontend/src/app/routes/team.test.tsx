import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { TeamConflictReason } from '@/api'
import { TYPE_STYLES } from '@/components/pokemon/pokemon-types'
import { browse, servePokemonChanges } from '@/test/handlers/pokemon'
import { holdNextCurrentUser, serveSession } from '@/test/handlers/session'
import { refuseTeamChange, serveAsh, serveTeams } from '@/test/handlers/teams'
import { onWideScreen } from '@/test/media'
import { holdRequests, server } from '@/test/server'
import { EDIT, renderTeam, serveTeamSections, slotRows, VIEW } from '@/test/team-page'
import { asMember, catalog, makeTeam, TEAM_ID } from '@/test/teams'
import { ASH, MISTY } from '@/test/users'

const { charmander, charizard, pikachu, snorlax } = catalog
const CATALOG = Object.values(catalog)

beforeEach(serveTeamSections)

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

  it('removes a Pokémon at once, before the API answers', async () => {
    const api = serveAsh([makeTeam({ pokemon: [charmander, pikachu] })])
    browse([])
    const hold = holdRequests('delete', '/api/teams/:teamId/members/:pokemonId')
    const { user } = renderTeam(EDIT)

    await user.click(await screen.findByRole('button', { name: 'Remove Charmander' }))

    expect(screen.queryByText('Charmander')).not.toBeInTheDocument()
    hold.release()
    await waitFor(() => expect(api.teams()[0].members).toHaveLength(1))
  })

  it('sends changes to a team one at a time, in order', async () => {
    const api = serveAsh([makeTeam({ pokemon: [charmander, pikachu] })])
    browse([])
    const hold = holdRequests('delete', '/api/teams/:teamId/members/:pokemonId')
    // How many changes the API had answered as each change arrived.
    const answered: number[] = []
    server.use(
      http.delete('/api/teams/:teamId/members/:pokemonId', () => {
        answered.push(api.requests.length)
      }),
    )
    const { user } = renderTeam(EDIT)

    await user.click(await screen.findByRole('button', { name: 'Remove Charmander' }))
    await user.click(screen.getByRole('button', { name: 'Remove Pikachu' }))
    await waitFor(() => expect(hold.arrived()).toBe(1))

    hold.release()

    await waitFor(() => expect(api.teams()[0].members).toEqual([]))
    // The second waited for the first, which was held, to be answered.
    expect(answered).toEqual([0, 1])
    expect(api.requests.map((request) => request.path)).toEqual([
      `/api/teams/${TEAM_ID}/members/4`,
      `/api/teams/${TEAM_ID}/members/25`,
    ])
  })

  it('undoes a change the API refuses, and says why', async () => {
    serveAsh([makeTeam({ pokemon: [charmander] })])
    browse([])
    refuseTeamChange(TeamConflictReason.ORDER_OUT_OF_DATE)
    const { user, queryClient } = renderTeam(EDIT)
    const remove = await screen.findByRole('button', { name: 'Remove Charmander' })
    // Held, so what shows is the change undone rather than the team fetched again.
    const fetches = holdRequests('get', '/api/teams/:teamId')

    await user.click(remove)

    expect(
      await screen.findByText('This team changed somewhere else, so it’s been reloaded.'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Charmander')).toBeInTheDocument()
    fetches.release()
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(slotRows()[0]).toHaveTextContent('Charmander')
  })

  it('shows the team as anyone sees it once a change finds you signed out', async () => {
    serveSession({ signedIn: ASH })
    // The API takes no changes from someone signed out.
    serveTeams({ teams: [makeTeam({ pokemon: [charmander] })], catalog: CATALOG })
    browse([])
    const { user } = renderTeam(EDIT)
    const remove = await screen.findByRole('button', { name: 'Remove Charmander' })
    // The session ends somewhere else.
    serveSession()

    await user.click(remove)

    expect(
      await screen.findByText('You’re signed out. Sign in again to change this team.'),
    ).toBeInTheDocument()
    expect(await screen.findByText('by ash')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
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
      expect(
        screen.getByText('Pick up to six Pokémon and put them in battle order.'),
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Everyone’s teams' })).toHaveAttribute('href', '/')
      expect(screen.queryByRole('link', { name: 'My teams' })).not.toBeInTheDocument()
      // Besides building a counter to the team, and how to beat it below, each member opens its
      // details, and that's all there is to press.
      const howToBeat = screen.getByRole('region', { name: 'How to beat this team' })
      expect(
        screen
          .getAllByRole('button', { name: (name) => name !== 'Build a counter to Team 1' })
          .filter((button) => !howToBeat.contains(button)),
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

describe('TeamPage, while it’s not yet known who’s signed in', () => {
  it('shows neither the party nor the builder on the Edit page', async () => {
    serveAsh([makeTeam({ pokemon: [charmander] })])
    browse([])
    const release = holdNextCurrentUser(ASH)
    const { queryClient } = renderTeam(EDIT)

    // Once the team has loaded: who's signed in, which is held, is all that's still being fetched.
    await waitFor(() => expect(queryClient.isFetching()).toBe(1))
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
