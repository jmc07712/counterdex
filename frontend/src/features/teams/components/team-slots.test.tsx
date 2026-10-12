import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { Pokemon, PokemonChange, TeamMember } from '@/api'
import { servePokemonChanges } from '@/test/handlers/pokemon'
import { makePokemon } from '@/test/pokemon'
import { termsAndDefinitions } from '@/test/queries'
import { renderWithProviders } from '@/test/render'
import { holdRequests, server } from '@/test/server'
import { asMember, catalog } from '@/test/teams'

import { EmptySlots, LeadSlot, PartySlots, ReplaceLink, TeamSlot, TeamSlots } from './team-slots'

const CHANGED_ON = '2026-10-09T09:00:00Z'
const charizard = { ...catalog.charizard, changed_recently: true }

// A sync's update to Charizard, which made it stronger and faster.
const UPDATED: PokemonChange = {
  kind: 'updated',
  detected_at: CHANGED_ON,
  before: { ...charizard, stats: { ...charizard.stats, attack: 120, speed: 76 } },
  after: charizard,
}
const REMOVED: PokemonChange = {
  kind: 'removed',
  detected_at: '2026-10-02T09:00:00Z',
  before: charizard,
  after: null,
}
// PokéAPI listing it again, a week after it stopped.
const RESTORED: PokemonChange = {
  kind: 'restored',
  detected_at: CHANGED_ON,
  before: charizard,
  after: charizard,
}
const REMOVED_CHARIZARD: TeamMember = { ...asMember(charizard, 0), removed_at: CHANGED_ON }

// The only slot rendered.
function slot() {
  const [first] = within(screen.getByRole('list', { name: 'Team, in battle order' })).getAllByRole(
    'listitem',
  )
  return first
}

// The text of each list item in `row`: its types, and the parts of its one-line change.
function listItems(row: HTMLElement) {
  return within(row)
    .getAllByRole('listitem')
    .map((item) => item.textContent)
}

function renderLead(member: TeamMember) {
  renderWithProviders(
    <PartySlots>
      <LeadSlot member={member} onOpen={vi.fn()} />
    </PartySlots>,
  )
  return slot()
}

function renderRow(member: TeamMember) {
  renderWithProviders(
    <TeamSlots>
      <TeamSlot member={member} onOpen={vi.fn()} />
    </TeamSlots>,
  )
  return slot()
}

describe('LeadSlot', () => {
  it('shows a changed lead’s newest change in full', async () => {
    servePokemonChanges([UPDATED, REMOVED])

    const lead = renderLead(asMember(charizard, 0))

    expect(await within(lead).findByText('Updated')).toBeInTheDocument()
    expect(within(lead).getByText('Oct 9, 2026')).toBeInTheDocument()
    expect(termsAndDefinitions(lead)).toEqual(
      expect.arrayContaining([
        ['Attack', '120 → 125'],
        ['Speed', '76 → 81'],
      ]),
    )
    expect(lead).not.toHaveTextContent('Removed from PokéAPI')
  })

  it('shows a lead PokéAPI lists again as back, and when', async () => {
    servePokemonChanges([RESTORED, REMOVED])

    const lead = renderLead(asMember(charizard, 0))

    expect(await within(lead).findByText('Back in PokéAPI')).toBeInTheDocument()
    expect(within(lead).getByText('Oct 9, 2026')).toBeInTheDocument()
  })

  it('shows a removed lead’s removal once, as the change, without asking for it', async () => {
    const asked = servePokemonChanges([REMOVED])

    const lead = renderLead(REMOVED_CHARIZARD)

    expect(within(lead).getAllByText(/Removed from PokéAPI/)).toHaveLength(1)
    expect(lead).toHaveTextContent('Removed from PokéAPI on Oct 9, 2026')
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(asked).toEqual([])
  })

  it('shows nothing of a lead no sync changed recently, without asking for its changes', async () => {
    const asked = servePokemonChanges([UPDATED])

    const lead = renderLead(asMember(catalog.charizard, 0))

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(asked).toEqual([])
    expect(lead).not.toHaveTextContent('Updated')
  })
})

describe('TeamSlot', () => {
  it('sums up a changed member’s newest change on one line: what it changed', async () => {
    servePokemonChanges([UPDATED, REMOVED])

    const row = renderRow(asMember(charizard, 1))

    await waitFor(() =>
      expect(listItems(row)).toEqual(expect.arrayContaining(['Attack 120 → 125', 'Speed 76 → 81'])),
    )
    expect(row).not.toHaveTextContent('Updated')
  })

  it('sums up a member PokéAPI lists again as back, and when', async () => {
    servePokemonChanges([RESTORED, REMOVED])

    const row = renderRow(asMember(charizard, 1))

    await waitFor(() =>
      expect(listItems(row)).toEqual(expect.arrayContaining(['Back in PokéAPI', 'Oct 9, 2026'])),
    )
  })

  it('shows a removed member’s removal once, as the change, without asking for it', async () => {
    const asked = servePokemonChanges([REMOVED])

    const row = renderRow({ ...REMOVED_CHARIZARD, position: 1 })

    expect(within(row).getAllByText(/Removed from PokéAPI/)).toHaveLength(1)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(asked).toEqual([])
  })

  it('marks a removal from this week with the dot the Pokédex marks a removal with', () => {
    const row = renderRow({ ...REMOVED_CHARIZARD, position: 1 })

    const line = within(row).getByText('Removed from PokéAPI on Oct 9, 2026')
    expect(line.querySelector('[aria-hidden="true"]')).toHaveClass('bg-destructive')
  })

  it('leaves a removal from before this week unmarked', () => {
    const row = renderRow({ ...asMember(catalog.charizard, 1), removed_at: '2026-09-01T09:00:00Z' })

    const line = within(row).getByText('Removed from PokéAPI on Sep 1, 2026')
    expect(line.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument()
  })

  it('shows a small skeleton while the change loads', async () => {
    servePokemonChanges([UPDATED])
    const changes = holdRequests('get', '/api/pokemon/:pokemonId/changes')

    const row = renderRow(asMember(charizard, 1))

    await waitFor(() => expect(row.querySelector('[data-slot=skeleton]')).toBeInTheDocument())
    changes.release()
    await waitFor(() => expect(row).toHaveTextContent('Attack 120 → 125'))
    expect(row.querySelector('[data-slot=skeleton]')).not.toBeInTheDocument()
  })

  it('shows nothing more when the change can’t load', async () => {
    let failed = false
    server.use(
      http.get('/api/pokemon/:pokemonId/changes', () => {
        failed = true
        return HttpResponse.json({ detail: 'Refused.' }, { status: 500 })
      }),
    )

    const row = renderRow(asMember(charizard, 1))

    await waitFor(() => expect(failed).toBe(true))
    await waitFor(() => expect(row.querySelector('[data-slot=skeleton]')).not.toBeInTheDocument())
    expect(row).not.toHaveTextContent('→')
  })

  it('fills its total’s bar for a total past the highest it measures against', () => {
    // 780, past 720.
    const stats = { hp: 106, attack: 190, defense: 100, sp_attack: 154, sp_defense: 100, speed: 130 }
    const member = asMember(makePokemon({ stats }), 0)

    renderWithProviders(
      <TeamSlots>
        <TeamSlot member={member} />
      </TeamSlots>,
    )

    const total = screen.getByText('Total').closest('dl')!
    expect(total).toHaveTextContent('780')
    // The bar's fill is slid left by what's missing from it: nothing.
    const bar = within(total).getByRole('progressbar', { hidden: true })
    expect(bar.querySelector('[data-slot=progress-indicator]')).toHaveStyle({
      transform: 'translateX(-0%)',
    })
  })
})

// Slots for these Pokémon, with buttons to add Snorlax and to remove the lead.
function ChangingTeam({ initial }: { initial: Pokemon[] }) {
  const [pokemon, setPokemon] = useState(initial)
  return (
    <>
      <button onClick={() => setPokemon([...pokemon, catalog.snorlax])}>Add Snorlax</button>
      <button onClick={() => setPokemon(pokemon.slice(1))}>Remove the lead</button>
      <TeamSlots>
        {pokemon.map((each, position) => (
          <TeamSlot key={each.id} member={asMember(each, position)} />
        ))}
        <EmptySlots filled={pokemon.length} />
      </TeamSlots>
    </>
  )
}

// How long each slot waits to enter, then how long each sprite in it waits to pop out.
function entranceDelays() {
  const slots = screen.getByRole('list', { name: 'Team, in battle order' })
  return [...slots.children].map((slot) =>
    [slot, ...slot.querySelectorAll<HTMLElement>('[style]')]
      .map((element) => (element as HTMLElement).style.animationDelay)
      .filter(Boolean),
  )
}

describe('TeamSlots', () => {
  it('enters the slots it first shows one after another, in battle order', () => {
    renderWithProviders(<ChangingTeam initial={[catalog.charmander, catalog.pikachu]} />)

    expect(entranceDelays()).toEqual([
      ['0ms', '150ms'],
      ['70ms', '220ms'],
      ['140ms'],
      ['210ms'],
      ['280ms'],
      ['350ms'],
    ])
  })

  it('shows a member or an empty slot it gets later at once', async () => {
    const { user } = renderWithProviders(
      <ChangingTeam initial={[catalog.charmander, catalog.pikachu]} />,
    )

    await user.click(screen.getByRole('button', { name: 'Add Snorlax' }))
    await user.click(screen.getByRole('button', { name: 'Remove the lead' }))

    // Pikachu and Snorlax, then the empty third slot, which came back with the lead's removal.
    expect(entranceDelays()).toEqual([
      ['70ms', '220ms'],
      ['0ms', '150ms'],
      ['0ms'],
      ['210ms'],
      ['280ms'],
      ['350ms'],
    ])
  })
})

describe('ReplaceLink', () => {
  it('says what it does on hover, as on phones it’s just its icon', () => {
    const member = asMember(catalog.charizard, 0)

    renderWithProviders(<ReplaceLink member={member} to="/teams/1/edit?replace=6" />)

    const link = screen.getByRole('link', { name: 'Replace Charizard' })
    expect(link).toHaveAttribute('title', 'Replace Charizard')
  })
})
