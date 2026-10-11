import type { TeamMember } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { formatList } from '@/lib/dates'
import { m } from '@/paraglide/messages.js'

/**
 * A sentence naming the members a sync changed in the last week, removed ones included: the first
 * two, and how many more if there are more. Null when it changed none.
 */
export function changedThisWeek(members: TeamMember[]): string | null {
  const names = members
    .filter((member) => member.pokemon.changed_recently)
    .map((member) => displayName(member.pokemon.name))
  if (names.length === 0) return null
  if (names.length === 1) return m.team_changed_one({ name: names[0] })
  if (names.length === 2) return m.team_changed_two({ first: names[0], second: names[1] })
  return m.team_changed_more({ names: formatList(names.slice(0, 2)), count: names.length - 2 })
}
