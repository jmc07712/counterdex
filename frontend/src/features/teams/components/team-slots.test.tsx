import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { makePokemon } from '@/test/pokemon'
import { renderWithProviders } from '@/test/render'
import { asMember } from '@/test/teams'

import { TeamSlot, TeamSlots } from './team-slots'

describe('TeamSlot', () => {
  it('fills its total’s bar for a total past the highest it measures against', () => {
    // 780, as Mega Mewtwo X's.
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
