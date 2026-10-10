import type { Pokemon, PokemonForm, Stats } from '@/api'

/** "charizard-mega-x" as "Charizard Mega X". */
export function displayName(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** "No. 0025": four digits, like the games' Pokédex. Alternate forms run past 10000. */
export function dexNumber(id: number): string {
  return `No. ${String(id).padStart(4, '0')}`
}

// How each kind of alternate form the API reports is labeled. A Record, so a new kind needs one.
const FORM_LABELS: Record<PokemonForm, string> = {
  mega: 'Mega',
  gigantamax: 'Gigantamax',
  alolan: 'Alolan',
  galarian: 'Galarian',
  hisuian: 'Hisuian',
  paldean: 'Paldean',
  other: 'Form',
}

/** A short label for an alternate form ("Mega", "Alolan"), or null for a default form. */
export function formLabel(pokemon: Pokemon): string | null {
  return pokemon.form ? FORM_LABELS[pokemon.form] : null
}

export function statTotal(stats: Stats): number {
  return Object.values(stats).reduce((total, value) => total + value, 0)
}
