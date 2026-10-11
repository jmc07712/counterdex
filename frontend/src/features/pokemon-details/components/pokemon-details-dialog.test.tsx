import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import type { PokemonChange } from '@/api'
import { servePokemonChanges, servePokemonDetails } from '@/test/handlers'
import { CHARIZARD, makeDetails } from '@/test/pokemon'
import { termsAndDefinitions } from '@/test/queries'
import { renderWithProviders } from '@/test/render'
import { server } from '@/test/server'

import { PokemonDetailsDialog } from './pokemon-details-dialog'

const SPED_UP: PokemonChange = {
  kind: 'updated',
  detected_at: '2026-10-09T09:00:00Z',
  before: CHARIZARD,
  after: { ...CHARIZARD, stats: { ...CHARIZARD.stats, speed: 110 } },
}

async function openDetails({ changes = [] as PokemonChange[] } = {}) {
  servePokemonChanges(changes)
  const onSelect = vi.fn()
  const onClose = vi.fn()
  const rendered = renderWithProviders(
    <PokemonDetailsDialog pokemonId={6} onSelect={onSelect} onClose={onClose} />,
  )
  const dialog = await screen.findByRole('dialog', { name: 'Charizard' })
  return { ...rendered, dialog, onSelect, onClose }
}

describe('PokemonDetailsDialog', () => {
  it('slides up from the bottom on phones', async () => {
    servePokemonDetails()

    const { dialog } = await openDetails()

    expect(dialog).toHaveAttribute('data-slot', 'sheet-content')
  })

  it('opens in the middle of wider screens, and closes', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(min-width: 48rem)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    servePokemonDetails()

    const { dialog, user, onClose } = await openDetails()
    expect(dialog).toHaveAttribute('data-slot', 'dialog-content')
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('shows the Pokémon with its species and base stats', async () => {
    servePokemonDetails()

    const { dialog } = await openDetails()

    expect(within(dialog).getByText('Flame Pokémon')).toBeInTheDocument()
    expect(termsAndDefinitions(dialog)).toContainEqual(['Speed', '81'])
  })

  it('lists the forms of its species, and shows another when chosen', async () => {
    servePokemonDetails()
    const { dialog, user, onSelect } = await openDetails()
    const forms = within(dialog).getByRole('list', { name: 'Forms' })

    await user.click(within(forms).getByRole('button', { name: /Charizard Mega X/ }))

    expect(onSelect).toHaveBeenCalledWith(10034)
    expect(within(forms).getByRole('button', { current: true })).toHaveTextContent('Charizard')
  })

  it('shows its evolution family and how each stage evolves', async () => {
    servePokemonDetails()

    const { dialog } = await openDetails()

    const evolution = within(dialog).getByRole('list', { name: 'Evolution' })
    const stages = within(evolution).getAllByRole('button').map((stage) => stage.textContent)
    expect(stages).toEqual(['Charmander', 'Charmeleon', 'Charizard'])
    const methods = within(evolution).getAllByRole('list', { name: 'How it evolves' })
    expect(methods.map((method) => method.textContent)).toEqual(['Lv. 16', 'Lv. 36'])
    expect(within(evolution).getByRole('button', { current: true })).toHaveTextContent('Charizard')
  })

  it('marks the stages a sync changed recently', async () => {
    const details = makeDetails()
    const charmeleon = details.evolution?.evolves_to[0]
    if (charmeleon?.pokemon) charmeleon.pokemon = { ...charmeleon.pokemon, changed_recently: true }
    servePokemonDetails(details)

    const { dialog } = await openDetails()

    const evolution = within(dialog).getByRole('list', { name: 'Evolution' })
    const changed = within(evolution).getAllByText('Changed recently')
    expect(changed.map((mark) => mark.closest('button')?.textContent)).toEqual([
      'CharmeleonChanged recently',
    ])
  })

  it('says when its species doesn’t evolve', async () => {
    const charizard = { id: 6, name: 'charizard', genus: 'Flame Pokémon' }
    servePokemonDetails(
      makeDetails({
        evolution: { species: charizard, pokemon: CHARIZARD, methods: [], evolves_to: [] },
      }),
    )

    const { dialog } = await openDetails()

    expect(within(dialog).getByText('Doesn’t evolve.')).toBeInTheDocument()
  })

  it('lists the changes syncs have found', async () => {
    servePokemonDetails()

    const { dialog } = await openDetails({ changes: [SPED_UP] })

    const history = await within(dialog).findByRole('list', { name: 'Changes' })
    expect(within(history).getByText('Updated')).toBeInTheDocument()
    expect(termsAndDefinitions(history)).toEqual([['Speed', '81 → 110']])
  })

  it('says when no sync has changed it', async () => {
    servePokemonDetails()

    const { dialog } = await openDetails()

    expect(
      await within(dialog).findByText('No changes since it joined the Pokédex.'),
    ).toBeInTheDocument()
  })

  it('says when PokéAPI no longer lists it', async () => {
    servePokemonDetails(makeDetails({ removed_at: '2026-10-11T09:00:00Z' }))

    const { dialog } = await openDetails()

    const notice = within(dialog).getByText(/PokéAPI stopped listing it on Oct 11, 2026/)
    expect(notice).toBeInTheDocument()
  })

  it('offers a retry when the Pokémon can’t load', async () => {
    servePokemonDetails()
    servePokemonChanges()
    // Added last, so it answers first: the first request fails, and the retry gets the details.
    server.use(
      http.get('/api/pokemon/:pokemonId', () => new HttpResponse(null, { status: 500 }), {
        once: true,
      }),
    )
    const { user } = renderWithProviders(
      <PokemonDetailsDialog pokemonId={6} onSelect={vi.fn()} onClose={vi.fn()} />,
    )

    await user.click(await screen.findByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('dialog', { name: 'Charizard' })).toBeInTheDocument()
  })

  it('closes when asked', async () => {
    servePokemonDetails()
    const { user, onClose } = await openDetails()

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
