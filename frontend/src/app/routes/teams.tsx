import { UsersRound } from 'lucide-react'
import { useRef } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { ResultsRegion } from '@/components/lists/results-region'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { paths } from '@/config/paths'
import { SignInPrompt } from '@/features/auth/components/sign-in-prompt'
import { NewTeamButton } from '@/features/teams/components/new-team-button'
import { TeamsFilters } from '@/features/teams/components/teams-filters'
import { TeamsGrid } from '@/features/teams/components/teams-grid'
import { NO_FILTERS, useTeamsFilters } from '@/features/teams/hooks/use-teams-filters'
import { useUserTeams } from '@/features/teams/hooks/use-user-teams'
import { useFocusAfterClearing } from '@/hooks/use-focus-after-clearing'
import { useCurrentUser } from '@/lib/auth'
import { m } from '@/paraglide/messages.js'

export function TeamsPage() {
  const currentUser = useCurrentUser()
  const user = currentUser.data
  const [filters, setFilters] = useTeamsFilters({ signedIn: Boolean(user) })
  // How many teams you have, to name the next one.
  const teamCount = useUserTeams(user?.username).data?.length
  const search = useRef<HTMLInputElement>(null)
  const results = useRef<HTMLElement>(null)
  const focusAfterClearing = useFocusAfterClearing(search, results)

  function clearFilters() {
    setFilters({ ...filters, ...NO_FILTERS })
    // The button leaves with the empty state, so focus would fall to the page.
    focusAfterClearing()
  }

  function showEveryone() {
    setFilters({ ...filters, scope: 'everyone' })
    // The button leaves with the empty state, so focus would fall to the page.
    focusAfterClearing()
  }

  // With no teams yet, the empty state of your own teams has the button instead.
  const offerNewTeam = teamCount !== undefined && (teamCount > 0 || filters.scope === 'everyone')

  return (
    <>
      <PageHeader
        title={m.teams_title()}
        description={m.teams_description()}
        action={offerNewTeam && <NewTeamButton teamCount={teamCount} />}
      />
      {currentUser.isError && (
        <Alert variant="destructive">
          <AlertTitle>{m.teams_session_check_failed()}</AlertTitle>
          <AlertDescription>{m.common_check_connection()}</AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm" onClick={() => void currentUser.refetch()}>
              {m.common_try_again()}
            </Button>
          </AlertAction>
        </Alert>
      )}
      {user === null && (
        <div className="mb-6">
          <SignInPrompt
            icon={<UsersRound />}
            title={m.teams_sign_in_title()}
            description={m.teams_sign_in_description()}
            // Once signed in, to their own teams.
            next={paths.home.getHref({ scope: 'mine' })}
          />
        </div>
      )}
      {/* Only once it's known who's signed in, so it never shows the wrong teams first. */}
      {user !== undefined && (
        <>
          <TeamsFilters
            filters={filters}
            onChange={setFilters}
            showScope={user !== null}
            searchRef={search}
          />
          <ResultsRegion ref={results}>
            <TeamsGrid
              filters={filters}
              owner={filters.scope === 'mine' ? user?.username : undefined}
              onClearFilters={clearFilters}
              onShowEveryone={showEveryone}
            />
          </ResultsRegion>
        </>
      )}
    </>
  )
}
