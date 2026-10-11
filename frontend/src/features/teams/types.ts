import type { Team } from '@/api'

import type { TeamChange } from './utils/apply-change'

/** What the builder shows of a team: a saved team, or a guest's draft. */
export type TeamShape = Pick<Team, 'name' | 'members'>

/**
 * A team and how to change it. `change` resolves to the team after the change, or undefined if
 * it failed (and said so).
 */
export type TeamEditor = {
  team: TeamShape
  change: (change: TeamChange) => Promise<TeamShape | undefined>
}
