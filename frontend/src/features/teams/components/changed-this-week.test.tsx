import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { TeamMember } from '@/api'
import { makePokemon } from '@/test/pokemon'
import { asMember } from '@/test/teams'

import { ChangedThisWeek } from './changed-this-week'

// A team of these Pokémon, by name, each changed recently or not.
function team(pokemon: [name: string, changed: boolean][]): TeamMember[] {
  return pokemon.map(([name, changed], position) =>
    asMember(makePokemon({ id: position + 1, name, changed_recently: changed }), position),
  )
}

describe('ChangedThisWeek', () => {
  it.each<[string, [string, boolean][], string]>([
    ['one', [['charizard', true], ['pikachu', false]], 'Charizard changed this week'],
    [
      'two',
      [['charizard', true], ['pikachu', false], ['porygon', true]],
      'Charizard and Porygon changed this week',
    ],
    [
      'three',
      [['charizard', true], ['porygon', true], ['mr-mime', true]],
      'Charizard, Porygon and 1 more changed this week',
    ],
    [
      'four',
      [['charizard', true], ['porygon', true], ['mr-mime', true], ['snorlax', true]],
      'Charizard, Porygon and 2 more changed this week',
    ],
  ])('names the %s members a sync changed this week, in battle order', (_, pokemon, line) => {
    render(<ChangedThisWeek members={team(pokemon)} />)

    expect(screen.getByText(line)).toBeInTheDocument()
  })

  it('names a member removed from the Pokédex this week too', () => {
    const [charizard, pikachu] = team([['charizard', false], ['pikachu', true]])

    render(
      <ChangedThisWeek members={[charizard, { ...pikachu, removed_at: '2026-10-11T09:00:00Z' }]} />,
    )

    expect(screen.getByText('Pikachu changed this week')).toBeInTheDocument()
  })

  it('shows nothing when no member changed this week', () => {
    const { container } = render(
      <ChangedThisWeek members={team([['charizard', false], ['pikachu', false]])} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
