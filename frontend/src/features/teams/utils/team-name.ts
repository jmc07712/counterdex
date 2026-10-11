import { m } from '@/paraglide/messages.js'

/** The longest team name the API takes, in characters, once spaces at either end are trimmed. */
export const MAX_TEAM_NAME_LENGTH = 40

// Characters as the API counts them: one each, even those JavaScript stores as two code units.
function characters(text: string) {
  return Array.from(text)
}

/**
 * The name for a counter to the team named `team`: "Counter to {team}", with the team's name cut
 * short and ended with "…" if the whole would be longer than MAX_TEAM_NAME_LENGTH.
 */
export function counterTeamName(team: string) {
  const name = m.team_counter_name({ team })
  if (characters(name).length <= MAX_TEAM_NAME_LENGTH) return name
  // The room left beside the message's own words, less one for the ellipsis.
  const room = MAX_TEAM_NAME_LENGTH - characters(m.team_counter_name({ team: '' })).length - 1
  const shortened = characters(team).slice(0, room).join('').trimEnd()
  return m.team_counter_name({ team: `${shortened}…` })
}
