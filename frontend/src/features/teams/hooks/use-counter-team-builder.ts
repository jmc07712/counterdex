import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import type { Team } from '@/api'
import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

import type { MatchupPool } from '../types'
import { PokedexNotSyncedError, useBuildCounterTeam } from './use-build-counter-team'

/**
 * Builds a counter to `team`, picked from `pool`, when `build` is called, then opens it to edit,
 * matched up against `team`. If it can't, a toast says why, with Try again when trying again could
 * help. Calls while it's building are ignored.
 */
export function useCounterTeamBuilder(team: Team, pool: MatchupPool) {
  const mutation = useBuildCounterTeam()
  const navigate = useNavigate()
  // One id for every try, so trying again after an answer that never came gets the team the API
  // already made, not a second one.
  const [id] = useState(() => crypto.randomUUID())
  // Set by the first call, at once: isPending changes only once the caller renders again, which
  // can be after a second click.
  const building = useRef(false)

  function build() {
    if (building.current) return
    building.current = true
    mutation.mutate(
      { id, team, pool },
      {
        onSuccess: (counter) =>
          void navigate(paths.teamEdit.getHref(counter.id, { against: team.id })),
        onError: (error) => {
          building.current = false
          if (error instanceof PokedexNotSyncedError) {
            toast.error(m.team_counter_needs_sync())
            return
          }
          toast.error(m.team_counter_failed(), {
            action: { label: m.common_try_again(), onClick: build },
          })
        },
      },
    )
  }

  return { build, isPending: mutation.isPending }
}
