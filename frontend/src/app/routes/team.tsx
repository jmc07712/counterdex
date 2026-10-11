import { UsersRound } from 'lucide-react'
import { useParams } from 'react-router'

import { paths } from '@/config/paths'
import { SignInPrompt } from '@/features/auth/components/sign-in-prompt'
import { SavedTeam } from '@/features/teams/components/saved-team'
import { useCurrentUser } from '@/lib/auth'
import { m } from '@/paraglide/messages.js'

export function TeamPage() {
  const { teamId = '' } = useParams()
  const currentUser = useCurrentUser()

  if (currentUser.isPending) return null
  if (currentUser.data) return <SavedTeam teamId={teamId} />
  return (
    <SignInPrompt
      icon={<UsersRound />}
      title={m.teams_sign_in_title()}
      description={m.teams_sign_in_description()}
      next={paths.team.getHref(teamId)}
    />
  )
}
