import { UsersRound } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { paths } from '@/config/paths'
import { SignInPrompt } from '@/features/auth/components/sign-in-prompt'
import { NewTeamButton } from '@/features/teams/components/new-team-button'
import { TeamList } from '@/features/teams/components/team-list'
import { useUserTeams } from '@/features/teams/hooks/use-user-teams'
import { useCurrentUser } from '@/lib/auth'
import { m } from '@/paraglide/messages.js'

export function TeamsPage() {
  const currentUser = useCurrentUser()
  const username = currentUser.data?.username
  const teams = useUserTeams(username)
  // With no teams yet, the list's own empty state has the button.
  const hasTeams = teams.data !== undefined && teams.data.length > 0

  return (
    <>
      <PageHeader
        title={m.teams_title()}
        description={m.teams_description()}
        action={hasTeams && <NewTeamButton teamCount={teams.data.length} />}
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
      {username && <TeamList username={username} />}
      {currentUser.data === null && (
        <SignInPrompt
          icon={<UsersRound />}
          title={m.teams_sign_in_title()}
          description={m.teams_sign_in_description()}
          next={paths.home.getHref()}
        />
      )}
    </>
  )
}
