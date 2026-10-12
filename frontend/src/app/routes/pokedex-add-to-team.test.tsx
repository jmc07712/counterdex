import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TeamConflictReason } from '@/api'
import { Toaster } from '@/components/layout/toaster'
import { browse, servePokemonChanges, servePokemonDetails } from '@/test/handlers/pokemon'
import { holdNextCurrentUser, serveSession } from '@/test/handlers/session'
import { refuseTeamChange, serveAsh } from '@/test/handlers/teams'
import { renderWithProviders } from '@/test/render'
import { failOnce, holdRequests } from '@/test/server'
import { catalog, makeTeam, TEAM_ID } from '@/test/teams'
import { ASH } from '@/test/users'

import { PokedexPage } from './pokedex'

describe('PokedexPage, adding a Pokémon to a team', () => {
  const { charmander, charizard, pikachu, gengar, lapras, eevee, snorlax, dragonite } = catalog

  function renderPokedex(path = '/pokedex') {
    return renderWithProviders(
      <>
        <PokedexPage />
        <Toaster />
      </>,
      { path },
    )
  }

  it('lists your teams, each with how many Pokémon it has, without opening the card', async () => {
    serveAsh([
      makeTeam({ name: 'Rain Squad', pokemon: [lapras, gengar, eevee] }),
      makeTeam({ id: crypto.randomUUID(), name: 'Fire' }),
    ])
    browse([pikachu])
    const { user, router } = renderPokedex()

    await user.click(await screen.findByRole('button', { name: 'Add to team: Pikachu' }))

    const menu = await screen.findByRole('menu', { name: 'Add to team: Pikachu' })
    const items = await within(menu).findAllByRole('menuitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveAccessibleName('Rain Squad 3 of 6')
    expect(items[1]).toHaveAccessibleName('Fire 0 of 6')
    expect(items[2]).toHaveAccessibleName('New team')
    expect(router.state.location.search).toBe('')
  })

  it('adds the Pokémon to the team you choose, and says so with a way to the team', async () => {
    const api = serveAsh([makeTeam({ name: 'Rain Squad', pokemon: [lapras] })])
    browse([charizard])
    const { user, router } = renderPokedex()

    await user.click(await screen.findByRole('button', { name: 'Add to team: Charizard' }))
    await user.click(await screen.findByRole('menuitem', { name: /^Rain Squad/ }))

    await waitFor(() =>
      expect(api.requests).toEqual([
        {
          method: 'POST',
          path: `/api/teams/${TEAM_ID}/members`,
          body: { pokemon_id: charizard.id },
        },
      ]),
    )
    const toast = (await screen.findByText('Added Charizard to Rain Squad')).closest('li')!
    await user.click(within(toast).getByRole('button', { name: 'Show team' }))
    expect(router.state.location.pathname).toBe(`/teams/${TEAM_ID}`)
  })

  it('shows the Pokémon on the team at once, before the API has answered', async () => {
    serveAsh([makeTeam({ name: 'Rain Squad', pokemon: [lapras] })])
    const held = holdRequests('post', '/api/teams/:teamId/members')
    browse([pikachu])
    const { user } = renderPokedex()
    const button = await screen.findByRole('button', { name: 'Add to team: Pikachu' })

    await user.click(button)
    await user.click(await screen.findByRole('menuitem', { name: /^Rain Squad/ }))
    await waitFor(() => expect(held.arrived()).toBe(1))
    await user.click(button)

    const team = await screen.findByRole('menuitem', { name: 'Rain Squad 2 of 6 On the team' })
    expect(team).toHaveAttribute('aria-disabled', 'true')
    held.release()
    expect(await screen.findByText('Added Pikachu to Rain Squad')).toBeInTheDocument()
  })

  it('says why when the API refuses the add', async () => {
    serveAsh([makeTeam({ name: 'Rain Squad', pokemon: [lapras] })])
    // The team filled up somewhere else.
    refuseTeamChange(TeamConflictReason.TEAM_FULL)
    browse([pikachu])
    const { user } = renderPokedex()

    await user.click(await screen.findByRole('button', { name: 'Add to team: Pikachu' }))
    await user.click(await screen.findByRole('menuitem', { name: /^Rain Squad/ }))

    expect(await screen.findByText('That team is full.')).toBeInTheDocument()
    expect(screen.queryByText('Added Pikachu to Rain Squad')).not.toBeInTheDocument()
  })

  it('says which teams can’t take it, and why', async () => {
    serveAsh([
      makeTeam({
        id: crypto.randomUUID(),
        name: 'Full',
        pokemon: [pikachu, gengar, lapras, eevee, snorlax, dragonite],
      }),
      makeTeam({ id: crypto.randomUUID(), name: 'Has Charmander', pokemon: [charmander] }),
      makeTeam({ id: crypto.randomUUID(), name: 'Has Charizard', pokemon: [charizard] }),
    ])
    browse([charizard])
    const { user } = renderPokedex()

    await user.click(await screen.findByRole('button', { name: 'Add to team: Charizard' }))

    const full = await screen.findByRole('menuitem', { name: 'Full 6 of 6 Team is full' })
    expect(full).toHaveAttribute('aria-disabled', 'true')
    const family = screen.getByRole('menuitem', {
      name: 'Has Charmander 1 of 6 Charmander’s family is on the team',
    })
    expect(family).toHaveAttribute('aria-disabled', 'true')
    const onIt = screen.getByRole('menuitem', { name: 'Has Charizard 1 of 6 On the team' })
    expect(onIt).toHaveAttribute('aria-disabled', 'true')
  })

  it('lets a team that can’t take it be reached, to read why, but adds nothing', async () => {
    const api = serveAsh([makeTeam({ name: 'Has Charizard', pokemon: [charizard] })])
    browse([charizard])
    const { user } = renderPokedex()

    await user.click(await screen.findByRole('button', { name: 'Add to team: Charizard' }))
    const team = await screen.findByRole('menuitem', { name: /^Has Charizard/ })
    await user.keyboard('{ArrowDown}')
    expect(team).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(api.requests).toEqual([])
  })

  it('starts a new team with the Pokémon, and opens it to edit', async () => {
    const api = serveAsh([makeTeam({ name: 'Team 1', pokemon: [lapras] })])
    browse([pikachu])
    const { user, router } = renderPokedex()

    await user.click(await screen.findByRole('button', { name: 'Add to team: Pikachu' }))
    await user.click(await screen.findByRole('menuitem', { name: 'New team' }))

    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/edit$/))
    const [created] = api.requests
    expect(api.requests).toEqual([
      { method: 'PUT', path: created.path, body: { name: 'Team 2', pokemon_ids: [pikachu.id] } },
    ])
    expect(router.state.location.pathname).toBe(`${created.path.replace('/api', '')}/edit`)
  })

  it('stays open while it creates the new team, with New team disabled', async () => {
    serveAsh()
    const held = holdRequests('put', '/api/teams/:teamId')
    browse([pikachu])
    const { user, router } = renderPokedex()

    await user.click(await screen.findByRole('button', { name: 'Add to team: Pikachu' }))
    await user.click(await screen.findByRole('menuitem', { name: 'New team' }))

    const creating = await screen.findByRole('menuitem', { name: 'Creating…' })
    expect(creating).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('menu', { name: 'Add to team: Pikachu' })).toBeInTheDocument()
    held.release()
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/edit$/))
  })

  it('links someone signed out to signing in first, then back to the Pokédex', async () => {
    serveSession()
    browse([pikachu])
    const { user } = renderPokedex('/pokedex?q=pika')

    await user.click(await screen.findByRole('button', { name: 'Add to team: Pikachu' }))

    const signIn = await screen.findByRole('menuitem', { name: 'Sign in' })
    expect(signIn).toHaveAttribute(
      'href',
      `/sign-in?next=${encodeURIComponent('/pokedex?q=pika')}`,
    )
    expect(signIn).toHaveAccessibleDescription(
      'Teams are saved to your account, so you’ll need to sign in.',
    )
  })

  it('says it’s loading your teams while it checks who’s signed in', async () => {
    serveAsh([makeTeam({ name: 'Rain Squad' })])
    const release = holdNextCurrentUser(ASH)
    browse([pikachu])
    const { user } = renderPokedex()

    await user.click(await screen.findByRole('button', { name: 'Add to team: Pikachu' }))

    const loading = await screen.findByRole('menuitem', { name: 'Loading your teams…' })
    expect(loading).toHaveAttribute('aria-disabled', 'true')
    release()
    expect(await screen.findByRole('menuitem', { name: /^Rain Squad/ })).toBeInTheDocument()
  })

  it('says it’s loading your teams until they arrive', async () => {
    serveAsh([makeTeam({ name: 'Rain Squad' })])
    const held = holdRequests('get', '/api/users/:username/teams')
    browse([pikachu])
    const { user } = renderPokedex()

    await user.click(await screen.findByRole('button', { name: 'Add to team: Pikachu' }))
    // Asked for only once it's known who's signed in.
    await waitFor(() => expect(held.arrived()).toBe(1))

    const loading = screen.getByRole('menuitem', { name: 'Loading your teams…' })
    expect(loading).toHaveAttribute('aria-disabled', 'true')
    held.release()
    expect(await screen.findByRole('menuitem', { name: /^Rain Squad/ })).toBeInTheDocument()
  })

  it('offers to try again when your teams can’t load', async () => {
    serveAsh([makeTeam({ name: 'Rain Squad' })])
    failOnce('/api/users/:username/teams', 500)
    browse([pikachu])
    const { user } = renderPokedex()

    await user.click(await screen.findByRole('button', { name: 'Add to team: Pikachu' }))
    const retry = await screen.findByRole('menuitem', { name: 'Try again' })
    expect(retry).toHaveAccessibleDescription('Couldn’t load your teams')
    await user.click(retry)

    expect(await screen.findByRole('menuitem', { name: /^Rain Squad/ })).toBeInTheDocument()
  })

  it('adds from a Pokémon’s details too', async () => {
    const api = serveAsh([makeTeam({ name: 'Rain Squad' })])
    browse([charizard])
    servePokemonDetails()
    servePokemonChanges()
    const { user } = renderPokedex(`/pokedex?pokemon=${charizard.id}`)

    const dialog = await screen.findByRole('dialog', { name: 'Charizard' })
    await user.click(within(dialog).getByRole('button', { name: 'Add to team: Charizard' }))
    await user.click(await screen.findByRole('menuitem', { name: /^Rain Squad/ }))

    await waitFor(() =>
      expect(api.teams()[0].members.map((member) => member.pokemon.id)).toEqual([charizard.id]),
    )
    expect(screen.getByRole('dialog', { name: 'Charizard' })).toBeInTheDocument()
  })

  it('puts focus back on its button once the menu closes', async () => {
    serveAsh([makeTeam({ name: 'Rain Squad' })])
    browse([pikachu])
    const { user } = renderPokedex()
    const button = await screen.findByRole('button', { name: 'Add to team: Pikachu' })

    await user.click(button)
    await screen.findByRole('menuitem', { name: /^Rain Squad/ })
    await user.keyboard('{Escape}')
    expect(button).toHaveFocus()

    await user.click(button)
    await user.click(await screen.findByRole('menuitem', { name: /^Rain Squad/ }))
    await waitFor(() => expect(button).toHaveFocus())
  })
})
