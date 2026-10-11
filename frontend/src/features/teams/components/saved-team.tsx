import { SearchX } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { Team } from '@/api'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { paths } from '@/config/paths'
import { useCurrentUser } from '@/lib/auth'
import { m } from '@/paraglide/messages.js'

import { useMatchupPool } from '../hooks/use-matchup-pool'
import { useTeam } from '../hooks/use-team'
import { BackLink } from './back-link'
import { BuildYourOwnTeam } from './build-your-own-team'
import { CounterTeamButton } from './counter-team-button'
import { HowToBeatTeam } from './how-to-beat-team'
import { TeamParty } from './team-party'

type SavedTeamProps = {
  teamId: string
  // Opens a member's details from the party.
  onOpenPokemon: (pokemonId: number) => void
  // What the team's owner sees of it, such as its party or its builder.
  children: (team: Team) => ReactNode
}

/**
 * A team, by id, once it has loaded. Its owner sees `children`; everyone else sees its party, with
 * a way to build a team of their own.
 */
export function SavedTeam({ teamId, onOpenPokemon, children }: SavedTeamProps) {
  const team = useTeam(teamId)
  const currentUser = useCurrentUser()
  // What a counter to someone else's team is picked from, the same as the one shown below it.
  const [pool] = useMatchupPool()

  if (team.isPending || currentUser.isPending) return <Skeleton className="h-72 rounded-2xl" />

  if (team.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{m.team_load_failed()}</AlertTitle>
        <AlertDescription>{m.common_check_connection()}</AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={() => void team.refetch()}>
            {m.common_try_again()}
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  if (team.data === null) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>{m.team_not_found_title()}</EmptyTitle>
          <EmptyDescription>{m.team_not_found_description()}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link to={paths.home.getHref()}>{m.team_go_to_teams()}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  // Signed out, or not sure who's signed in, counts as not the owner.
  const isOwner = currentUser.data?.username === team.data.owner.username
  if (!isOwner) {
    return (
      <>
        <TeamParty
          team={team.data}
          onOpenPokemon={onOpenPokemon}
          back={<BackLink to={paths.home.getHref()}>{m.teams_everyones()}</BackLink>}
          actions={
            team.data.members.length > 0 && <CounterTeamButton team={team.data} pool={pool} />
          }
        />
        {team.data.members.length > 0 && <HowToBeatTeam team={team.data} />}
        <BuildYourOwnTeam />
      </>
    )
  }
  return children(team.data)
}
