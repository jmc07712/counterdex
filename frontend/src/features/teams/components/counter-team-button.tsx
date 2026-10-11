import { LoaderCircle, Swords } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'

import type { Team } from '@/api'
import { Button } from '@/components/ui/button'
import { paths } from '@/config/paths'
import { useCurrentUser } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { PokedexNotSyncedError, useBuildCounterTeam } from '../hooks/use-build-counter-team'

// On touch screens it takes taps across a band 44px tall, without taking more room.
const TAP_AREA =
  'relative pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:top-1/2 pointer-coarse:after:h-11 pointer-coarse:after:-translate-y-1/2'

/**
 * Builds a counter to someone else's team as a new team, and opens it to edit. Signed out, it's a
 * link to sign in, which comes back to this page.
 */
export function CounterTeamButton({ team }: { team: Team }) {
  const currentUser = useCurrentUser()
  if (currentUser.data === null) return <SignInToCounter team={team} />
  return <BuildCounterButton team={team} />
}

function BuildCounterButton({ team }: { team: Team }) {
  const build = useBuildCounterTeam()
  const navigate = useNavigate()
  // One id for every try, so trying again after an answer that never came gets the team the API
  // already made, not a second one.
  const [id] = useState(() => crypto.randomUUID())
  // Set by the first click, at once: isPending changes only once the button renders again, which
  // can be after a second click.
  const building = useRef(false)

  function handleClick() {
    if (building.current) return
    building.current = true
    build.mutate(
      { id, team },
      {
        onSuccess: (counter) => void navigate(paths.teamEdit.getHref(counter.id)),
        onError: (error) => {
          building.current = false
          if (error instanceof PokedexNotSyncedError) {
            toast.error(m.team_counter_needs_sync())
            return
          }
          toast.error(m.team_counter_failed(), {
            action: { label: m.common_try_again(), onClick: handleClick },
          })
        },
      },
    )
  }

  return (
    <Button
      variant="outline"
      aria-label={
        build.isPending
          ? m.team_counter_building_named({ team: team.name })
          : m.team_counter_named({ team: team.name })
      }
      aria-busy={build.isPending}
      // Not disabled, which would drop its focus to the page and let taps through to the card's
      // link; handleClick ignores clicks while it builds.
      aria-disabled={build.isPending}
      onClick={handleClick}
      className={cn(TAP_AREA, 'aria-disabled:opacity-50')}
    >
      {build.isPending ? (
        <LoaderCircle aria-hidden="true" className="animate-spin" />
      ) : (
        <Swords aria-hidden="true" />
      )}
      {/* Both words take up room, so the button keeps its width as one replaces the other. */}
      <span className="grid *:col-start-1 *:row-start-1">
        <span className={cn(build.isPending && 'invisible')}>{m.team_counter()}</span>
        <span className={cn(!build.isPending && 'invisible')}>{m.team_counter_building()}</span>
      </span>
    </Button>
  )
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
