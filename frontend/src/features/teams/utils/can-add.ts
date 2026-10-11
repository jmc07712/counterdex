import { type Pokemon, TeamConflictReason, type TeamMember } from '@/api'

export const MAX_TEAM_SIZE = 6

type CantAdd =
  | typeof TeamConflictReason.TEAM_FULL
  | typeof TeamConflictReason.FAMILY_ON_TEAM

/**
 * The member from the Pokémon's evolution family: the Pokémon itself, or another of its stages or
 * forms. A Pokémon whose family isn't known yet is from no family.
 */
export function familyMember(members: TeamMember[], pokemon: Pokemon): TeamMember | undefined {
  return members.find(
    (member) =>
      member.pokemon.id === pokemon.id ||
      (pokemon.family_id != null && member.pokemon.family_id === pokemon.family_id),
  )
}

/** Why the Pokémon can't join these members, or null if it can. Matches the API's rules. */
export function cantAdd(members: TeamMember[], pokemon: Pokemon): CantAdd | null {
  if (familyMember(members, pokemon)) return TeamConflictReason.FAMILY_ON_TEAM
  if (members.length >= MAX_TEAM_SIZE) return TeamConflictReason.TEAM_FULL
  return null
}
