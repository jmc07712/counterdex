import { useParams } from 'react-router'

import { SavedTeam } from '@/features/teams/components/saved-team'

export function TeamPage() {
  const { teamId = '' } = useParams()
  return <SavedTeam teamId={teamId} />
}
