import { m } from '@/paraglide/messages.js'

/** The longest team name the API takes, in characters, once spaces at either end are trimmed. */
export const MAX_TEAM_NAME_LENGTH = 40

// What a reader sees as one character, such as a flag or a family emoji, can be several to the
// API.
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// Characters as the API counts them: one each, even those JavaScript stores as two code units.
function length(text: string) {
  return Array.from(text).length
}

// The start of `text`, up to `room` characters long, cut only between what a reader sees as
// characters.
function startOf(text: string, room: number) {
  let start = ''
  let used = 0
  for (const { segment } of graphemes.segment(text)) {
    used += length(segment)
    if (used > room) break
    start += segment
  }
  return start
}

/**
 * The name for a counter to the team named `team`: "Counter to {team}", with the team's name cut
 * short and ended with "…" if the whole would be longer than MAX_TEAM_NAME_LENGTH.
 */
export function counterTeamName(team: string) {
  const name = m.team_counter_name({ team })
  if (length(name) <= MAX_TEAM_NAME_LENGTH) return name
  // The room left beside the message's own words, less one for the ellipsis.
  const room = MAX_TEAM_NAME_LENGTH - length(m.team_counter_name({ team: '' })) - 1
  return m.team_counter_name({ team: `${startOf(team, room).trimEnd()}…` })
}
