import { type Pokemon, TeamConflictReason, type TeamMember } from '@/api'

export const MAX_TEAM_SIZE = 6

export type CantAdd =
  | typeof TeamConflictReason.TEAM_FULL
  | typeof TeamConflictReason.FAMILY_ON_TEAM

/** Why the Pokémon can't join these members, or null if it can. Matches the API's rules. */
export function cantAdd(members: TeamMember[], pokemon: Pokemon): CantAdd | null {
  const sameFamily = members.some(
    (member) =>
      member.pokemon.id === pokemon.id ||
      (pokemon.family_id != null && member.pokemon.family_id === pokemon.family_id),
  )
  if (sameFamily) return TeamConflictReason.FAMILY_ON_TEAM
  if (members.length >= MAX_TEAM_SIZE) return TeamConflictReason.TEAM_FULL
  return null
}
