import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { EvolutionMethod } from '@/api'

import { EvolutionMethodChips } from './evolution-method-chips'

function chipLabels(method: EvolutionMethod) {
  render(<EvolutionMethodChips method={method} />)
  const list = screen.getByRole('list', { name: 'How it evolves' })
  const chips = within(list).getAllByRole('listitem')
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

  it('shows a chip for every condition the API can send', () => {
    // Required, so a condition the API adds must be added here, and the length check below then
    // needs a chip for it.
    const everyCondition: Required<EvolutionMethod> = {
      trigger: 'level-up',
      min_level: 36,
      item: 'thunder-stone',
      held_item: 'metal-coat',
      known_move: 'ancient-power',
      known_move_type: 'fairy',
      used_move: 'rage-fist',
      min_move_count: 20,
      trade_species: 'shelmet',
      party_species: 'remoraid',
      party_type: 'dark',
      min_happiness: 160,
      min_steps: 1000,
      min_damage_taken: 294,
      relative_physical_stats: 'attack-higher',
      location: 'mount-coronet',
      region: 'alola',
      time_of_day: 'night',
      gender: 'female',
      needs_overworld_rain: true,
      needs_multiplayer: true,
      turn_upside_down: true,
      chance: 50,
    }

    const labels = chipLabels(everyCondition)

    // The level stands in for the trigger, so every other field has its own chip.
    expect(labels).toHaveLength(Object.keys(everyCondition).length - 1)
    expect(labels).toEqual([
      'Lv. 36',
      'Thunder Stone',
      'Metal Coat',
      'Knows Ancient Power',
      'Fairy-type move',
      'Rage Fist',
      '20 times',
      'For Shelmet',
      'Remoraid in party',
      'Dark type in party',
      'High friendship',
      '1,000 steps',
      '294 damage',
      'Attack > Defense',
      'Mount Coronet',
      'Alola',
      'Night',
      '♀ Female',
      'Raining',
      'With another player',
      'Console upside down',
      '50% chance',
    ])
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
