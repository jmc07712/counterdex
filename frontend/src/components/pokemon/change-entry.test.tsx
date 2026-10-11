import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { ChangeKind, Pokemon, PokemonChange } from '@/api'
import { CHARIZARD } from '@/test/pokemon'
import { termsAndDefinitions } from '@/test/queries'

import { ChangeDot, ChangeEntry, ChangeSummary } from './change-entry'

const DETECTED_AT = '2026-10-09T09:00:00Z'

// Charizard as a sync might find it next: renamed, retyped, restatted, a Mega, and redrawn.
const REWORKED: Pokemon = {
  ...CHARIZARD,
  name: 'charizard-mega-x',
  types: ['fire', 'dragon'],
  stats: { ...CHARIZARD.stats, attack: 130, speed: 100 },
  is_default: false,
  form: 'mega',
  sprite_url: 'https://example.com/10034.png',
}

// The one-line summary's parts, each as its own item.
function summaryItems() {
  const summary = screen.getByRole('list')
  return within(summary)
    .getAllByRole('listitem')
    .map((item) => item.textContent)
}

function change(kind: ChangeKind, before: Pokemon | null, after: Pokemon | null): PokemonChange {
  return { kind, detected_at: DETECTED_AT, before, after }
}

describe('ChangeEntry', () => {
  it('shows an update’s kind and date, then each field it changed, in order', () => {
    const { container } = render(<ChangeEntry change={change('updated', CHARIZARD, REWORKED)} />)

    expect(screen.getByText('Updated')).toBeInTheDocument()
    expect(screen.getByText('Oct 9, 2026')).toHaveAttribute('datetime', DETECTED_AT)
    expect(termsAndDefinitions(container)).toEqual([
      ['Name', 'Charizard → Charizard Mega X'],
      ['Types', 'Fire, Flying → Fire, Dragon'],
      ['Attack', '125 → 130'],
      ['Speed', '81 → 100'],
      ['Form', 'Standard → Mega'],
      ['Sprite', 'New image'],
    ])
  })

  it('shows a removal’s kind and date, with nothing after it to compare', () => {
    const { container } = render(<ChangeEntry change={change('removed', CHARIZARD, null)} />)

    expect(container).toHaveTextContent('Removed from PokéAPI')
    expect(screen.getByText('Oct 9, 2026')).toBeInTheDocument()
    expect(container.querySelector('dl')).not.toBeInTheDocument()
  })

  it('shows a restoration’s kind and date, and what changed while it was away', () => {
    const after = { ...CHARIZARD, stats: { ...CHARIZARD.stats, speed: 100 } }

    const { container } = render(<ChangeEntry change={change('restored', CHARIZARD, after)} />)

    expect(container).toHaveTextContent('Back in PokéAPI')
    expect(screen.getByText('Oct 9, 2026')).toBeInTheDocument()
    expect(termsAndDefinitions(container)).toEqual([['Speed', '81 → 100']])
  })
})

describe('ChangeSummary', () => {
  it('sums up an update on one line: each field it changed, as an item of its own, in order', () => {
    const { container } = render(<ChangeSummary change={change('updated', CHARIZARD, REWORKED)} />)

    expect(summaryItems()).toEqual([
      'Name Charizard → Charizard Mega X',
      'Types Fire, Flying → Fire, Dragon',
      'Attack 125 → 130',
      'Speed 81 → 100',
      'Form Standard → Mega',
      'Sprite New image',
    ])
    expect(container).not.toHaveTextContent('Updated')
  })

  it.each<[ChangeKind, Pokemon | null, string]>([
    ['removed', null, 'Removed from PokéAPI'],
    ['restored', REWORKED, 'Back in PokéAPI'],
  ])('sums up a change %s as its kind and date', (kind, after, words) => {
    render(<ChangeSummary change={change(kind, CHARIZARD, after)} />)

    expect(summaryItems()).toEqual([words, 'Oct 9, 2026'])
  })
})

describe('ChangeDot', () => {
  it.each<[ChangeKind, string]>([
    ['updated', 'bg-led-yellow'],
    ['removed', 'bg-destructive'],
    ['restored', 'bg-led-green'],
  ])('marks a change %s in %s', (kind, color) => {
    const { container } = render(<ChangeDot kind={kind} />)

    expect(container.firstChild).toHaveClass(color)
  })
})
