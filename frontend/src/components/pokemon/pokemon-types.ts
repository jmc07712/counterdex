import { PokemonType } from '@/api'

/** Every type a Pokémon can have, in the games' order, as the API defines them. */
export const POKEMON_TYPES: PokemonType[] = Object.values(PokemonType)

const INK = '#1c2033'
const WHITE = '#ffffff'

type TypeStyle = { background: string; foreground: string }

// The games' color for each type, and a text color that reads on it. A test checks every pair
// meets WCAG AA.
export const TYPE_STYLES: Record<PokemonType, TypeStyle> = {
  normal: { background: '#a8a77a', foreground: INK },
  fighting: { background: '#c22e28', foreground: WHITE },
  flying: { background: '#a98ff3', foreground: INK },
  poison: { background: '#a33ea1', foreground: WHITE },
  ground: { background: '#e2bf65', foreground: INK },
  rock: { background: '#b6a136', foreground: INK },
  bug: { background: '#a6b91a', foreground: INK },
  ghost: { background: '#735797', foreground: WHITE },
  steel: { background: '#b7b7ce', foreground: INK },
  fire: { background: '#ee8130', foreground: INK },
  water: { background: '#6390f0', foreground: INK },
  grass: { background: '#7ac74c', foreground: INK },
  electric: { background: '#f7d02c', foreground: INK },
  psychic: { background: '#f95587', foreground: INK },
  ice: { background: '#96d9d6', foreground: INK },
  dragon: { background: '#6f35fc', foreground: WHITE },
  dark: { background: '#705746', foreground: WHITE },
  fairy: { background: '#d685ad', foreground: INK },
}

/** A Pokémon has at most two types, so the type filter keeps at most two. */
export const MAX_TYPES = 2

/** The values that are Pokémon types, in the order given (e.g. from a URL), as typed values. */
export function toPokemonTypes(values: string[]): PokemonType[] {
  return values.flatMap((value) => POKEMON_TYPES.filter((type) => type === value))
}
