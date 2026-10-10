import Color from 'colorjs.io'
import { describe, expect, it } from 'vitest'

import { POKEMON_TYPES, TYPE_STYLES } from './pokemon-types'

describe('Pokémon types', () => {
  it('lists every type the API knows, in the games’ order', () => {
    expect(POKEMON_TYPES).toHaveLength(18)
    expect(POKEMON_TYPES.slice(0, 3)).toEqual(['normal', 'fighting', 'flying'])
  })

  it.each(POKEMON_TYPES)('keeps %s labels readable (WCAG AA, 4.5:1)', (type) => {
    const { background, foreground } = TYPE_STYLES[type]

    expect(Color.contrastWCAG21(background, foreground)).toBeGreaterThanOrEqual(4.5)
  })
})
