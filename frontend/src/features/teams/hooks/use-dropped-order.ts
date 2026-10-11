import { useState } from 'react'

import type { TeamShape } from '../types'
import { withOrder } from '../utils/changed-team'

/**
 * The team in the order its slots were last dropped in, until the team itself changes; and a
 * function to drop them in a new order. The team's own change to that order lands a moment after
 * the drop, and without this its slots would show their old order in between.
 */
export function useDroppedOrder(team: TeamShape) {
  const [dropped, setDropped] = useState<{ team: TeamShape; pokemonIds: number[] }>()
  const shown = dropped?.team === team ? withOrder(team, dropped.pokemonIds) : team
  const drop = (pokemonIds: number[]) => setDropped({ team, pokemonIds })
  return [shown, drop] as const
}
