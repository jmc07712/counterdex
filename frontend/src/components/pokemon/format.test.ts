import { describe, expect, it } from 'vitest'

import { makePokemon } from '@/test/pokemon'

import { dexNumber, displayName, formLabel } from './format'

describe('formatting a Pokémon', () => {
  it.each([
    ['pikachu', 'Pikachu'],
    ['charizard-mega-x', 'Charizard Mega X'],
  ])('shows %s as %s', (name, shown) => {
    expect(displayName(name)).toBe(shown)
  })

  it('pads Pokédex numbers to four digits', () => {
    expect(dexNumber(25)).toBe('No. 0025')
    expect(dexNumber(10034)).toBe('No. 10034')
  })

  it.each([
    ['mega', 'Mega'],
    ['gigantamax', 'Gigantamax'],
    ['alolan', 'Alolan'],
    ['other', 'Form'],
  ] as const)('labels the %s form as %s', (form, label) => {
    expect(formLabel(makePokemon({ is_default: false, form }))).toBe(label)
  })

  it('gives default forms no label', () => {
    expect(formLabel(makePokemon({ form: null }))).toBeNull()
  })
})
