import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { EvolutionMethod } from '@/api'

import { EvolutionMethodChips } from './evolution-method-chips'

function chipLabels(method: EvolutionMethod) {
  render(<EvolutionMethodChips method={method} />)
  const chips = within(screen.getByRole('list', { name: 'How it evolves' })).getAllByRole('listitem')
  return chips.map((chip) => chip.textContent)
}

// Real methods from PokéAPI's latest games, as the API serves them.
describe('EvolutionMethodChips', () => {
  it.each<[EvolutionMethod, string[]]>([
    [{ trigger: 'level-up', min_level: 16 }, ['Lv. 16']],
    [{ trigger: 'use-item', item: 'thunder-stone', region: 'alola' }, ['Thunder Stone', 'Alola']],
    [{ trigger: 'trade', held_item: 'metal-coat' }, ['Trade', 'Metal Coat']],
    [
      { trigger: 'level-up', min_happiness: 160, time_of_day: 'day' },
      ['Level up', 'High friendship', 'Day'],
    ],
    [
      { trigger: 'level-up', min_level: 20, relative_physical_stats: 'attack-higher' },
      ['Lv. 20', 'Attack > Defense'],
    ],
    [
      { trigger: 'recoil-damage', min_damage_taken: 294, gender: 'male' },
      ['Recoil damage', '294 damage', '♂ Male'],
    ],
    [
      { trigger: 'use-move', used_move: 'rage-fist', min_move_count: 20 },
      ['Use move', 'Rage Fist', '20 times'],
    ],
  ])('shows %o as %j', (method, labels) => {
    expect(chipLabels(method)).toEqual(labels)
  })

  it('pictures the item it uses', () => {
    const { container } = render(
      <EvolutionMethodChips method={{ trigger: 'use-item', item: 'thunder-stone' }} />,
    )

    // Decorative: the chip's label names the item.
    expect(within(container).getByRole('presentation')).toHaveAttribute(
      'src',
      'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/thunder-stone.png',
    )
  })
})
