import type { PokemonType } from '@/api'
import { m } from '@/paraglide/messages.js'
import { getLocale } from '@/paraglide/runtime.js'

/** "Fire, Flying" */
export function formatList(items: string[]) {
  return new Intl.ListFormat(getLocale(), { type: 'unit', style: 'short' }).format(items)
}

/** "Charizard", "Charizard and Pidgeot", "Charizard, Pidgeot and Venusaur" */
export function andList(items: string[]) {
  if (items.length === 1) return items[0]
  const last = items[items.length - 1]
  return m.common_list_and({ items: formatList(items.slice(0, -1)), last })
}

/** Types in words, in their order: "Fire, Flying" */
export function formatTypes(types: PokemonType[]) {
  return formatList(types.map((type) => m.pokemon_type({ type })))
}
