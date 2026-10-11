import type { Pokemon, Team } from '@/api'

/** What the builder shows of a team. */
export type TeamShape = Pick<Team, 'name' | 'members'>

/**
 * A team and how to change it. Each change resolves to the team after it, or undefined if it
 * failed (and said why).
 */
export type TeamEditor = {
  team: TeamShape
  add: (pokemon: Pokemon) => Promise<TeamShape | undefined>
  // Puts `pokemon` in the slot of the member `pokemonId`.
  replace: (pokemonId: number, pokemon: Pokemon) => Promise<TeamShape | undefined>
  remove: (pokemonId: number) => Promise<TeamShape | undefined>
  reorder: (pokemonIds: number[]) => Promise<TeamShape | undefined>
  rename: (name: string) => Promise<TeamShape | undefined>
}
