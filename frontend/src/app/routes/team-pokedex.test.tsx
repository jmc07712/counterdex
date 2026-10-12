import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { displayName } from '@/components/pokemon/format'
import { browse, servePokemonChanges, servePokemonDetails } from '@/test/handlers/pokemon'
import { serveAsh } from '@/test/handlers/teams'
import { onWideScreen } from '@/test/media'
import { EDIT, renderTeam, serveTeamSections, slotRows } from '@/test/team-page'
import { catalog, makeTeam, memberIds, TEAM_ID } from '@/test/teams'

const { charmander, charizard, charizardMegaX, pikachu, snorlax, gengar, lapras, eevee } = catalog

beforeEach(serveTeamSections)

describe('TeamPage, adding from the Pokédex', () => {
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
    expect(sheet).toHaveAttribute('data-side', 'bottom')
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
    ['a later stage', [charmander, pikachu], charizard, [6, 25]],
    ['another form of a later stage', [charmander, pikachu], charizardMegaX, [10034, 25]],
    ['a later stage, of a member that isn’t the lead', [pikachu, charmander], charizard, [25, 6]],
  ])(
    'offers to replace the member from a Pokémon’s family on the team: %s',
    async (_, members, pokemon, replaced) => {
      onWideScreen()
      const api = serveAsh([makeTeam({ pokemon: members })])
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

      await waitFor(() => expect(memberIds(api.teams()[0])).toEqual(replaced))
      expect(api.requests).toEqual([
        {
          method: 'PUT',
          path: `/api/teams/${TEAM_ID}/members/${charmander.id}`,
          body: { pokemon_id: pokemon.id },
        },
      ])
    },
  )

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
})
