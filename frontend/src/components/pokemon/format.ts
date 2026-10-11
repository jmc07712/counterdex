import type { Pokemon, Stats } from '@/api'
import { m } from '@/paraglide/messages.js'

/** "charizard-mega-x" as "Charizard Mega X". */
export function displayName(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** "No. 0025": four digits, like the games' Pokédex. Alternate forms run past 10000. */
export function dexNumber(id: number): string {
  return m.pokemon_dex_number({ number: String(id).padStart(4, '0') })
}

/** A short label for an alternate form ("Mega", "Alolan"), or null for a default form. */
export function formLabel(pokemon: Pokemon): string | null {
  return pokemon.form ? m.pokemon_form({ form: pokemon.form }) : null
}

/** The base stats, in the order the games show them. */
export const STATS = [
  'hp',
  'attack',
  'defense',
  'sp_attack',
  'sp_defense',
  'speed',
] as const satisfies (keyof Stats)[]

export function statTotal(stats: Stats): number {
  return Object.values(stats).reduce((total, value) => total + value, 0)
}
