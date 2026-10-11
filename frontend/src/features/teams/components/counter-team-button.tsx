import { LoaderCircle, Swords } from 'lucide-react'
import { Link, useLocation } from 'react-router'

import type { Team } from '@/api'
import { Button } from '@/components/ui/button'
import { paths } from '@/config/paths'
import { useCurrentUser } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { useCounterTeamBuilder } from '../hooks/use-counter-team-builder'
import { DEFAULT_POOL } from '../hooks/use-matchup-pool'
import type { MatchupPool } from '../types'

// On touch screens it takes taps across a band 44px tall, without taking more room.
const TAP_AREA =
  'relative pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:top-1/2 pointer-coarse:after:h-11 pointer-coarse:after:-translate-y-1/2'

type CounterTeamButtonProps = {
  team: Team
  // What the counter is picked from; by default, what the API picks from unless asked.
  pool?: MatchupPool
}

/**
 * Builds a counter to someone else's team as a new team, and opens it to edit. Signed out, it's a
 * link to sign in, which comes back to this page.
 */
export function CounterTeamButton({ team, pool = DEFAULT_POOL }: CounterTeamButtonProps) {
  const currentUser = useCurrentUser()
  if (currentUser.data === null) return <SignInToCounter team={team} />
  return <BuildCounterButton team={team} pool={pool} />
}

type BuildThisCounterProps = {
  team: Team
  pool: MatchupPool
  // While the counter shown is the last pool's and this pool's loads.
  loading: boolean
}

/**
 * "Build this counter", under the counter shown for someone else's team: builds it as a new team
 * and opens it to edit, once it's the counter for `pool`. Signed out, it's a link to sign in,
 * which comes back to this page.
 */
export function BuildThisCounter({ team, pool, loading }: BuildThisCounterProps) {
  const currentUser = useCurrentUser()
  if (currentUser.data === null) return <SignInToBuildThis />
  return <BuildThisCounterButton team={team} pool={pool} loading={loading} />
}

function BuildCounterButton({ team, pool }: { team: Team; pool: MatchupPool }) {
  const { build, isPending } = useCounterTeamBuilder(team, pool)
  return (
    <Button
      variant="outline"
      aria-label={
        isPending
          ? m.team_counter_building_named({ team: team.name })
          : m.team_counter_named({ team: team.name })
      }
      aria-busy={isPending}
      // Not disabled, which would drop its focus to the page and let taps through to the card's
      // link; build ignores clicks while it builds.
      aria-disabled={isPending}
      onClick={build}
      className={cn(TAP_AREA, 'aria-disabled:opacity-50')}
    >
      <BuildIcon building={isPending} />
      {/* Both words take up room, so the button keeps its width as one replaces the other. */}
      <span className="grid *:col-start-1 *:row-start-1">
        <span className={cn(isPending && 'invisible')}>{m.team_counter()}</span>
        <span className={cn(!isPending && 'invisible')}>{m.team_counter_building()}</span>
      </span>
    </Button>
  )
}

function BuildThisCounterButton({ team, pool, loading }: BuildThisCounterProps) {
  const { build, isPending } = useCounterTeamBuilder(team, pool)
  const busy = isPending || loading
  return (
    <Button
      aria-busy={busy}
      // Not disabled, which would drop its focus to the page. Clicks are ignored while the counter
      // loads, and build ignores them while it builds.
      aria-disabled={busy}
      onClick={() => {
        if (!loading) build()
      }}
      className="aria-disabled:opacity-50"
    >
      <BuildIcon building={busy} />
      {m.team_counter_build()}
    </Button>
  )
}

function BuildIcon({ building }: { building: boolean }) {
  if (building) return <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
  return <Swords aria-hidden="true" />
}

function SignInToCounter({ team }: { team: Team }) {
  const { pathname, search } = useLocation()
  return (
    <Button asChild variant="outline" className={TAP_AREA}>
      <Link
        to={paths.signIn.getHref(pathname + search)}
        aria-label={m.team_counter_named({ team: team.name })}
      >
        <Swords aria-hidden="true" />
        {m.team_counter()}
      </Link>
    </Button>
  )
}

function SignInToBuildThis() {
  const { pathname, search } = useLocation()
  return (
    <Button asChild>
      <Link to={paths.signIn.getHref(pathname + search)}>
        <Swords aria-hidden="true" />
        {m.team_counter_build()}
      </Link>
    </Button>
  )
}
