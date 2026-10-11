import { renameTeam, type Team } from '@/api'

import { withName } from '../utils/changed-team'
import { teamAfter } from '../utils/team-change-error'
import { useTeamChange } from './use-team-change'

export function useRenameTeam(team: Team) {
  const path = { team_id: team.id }
  return useTeamChange(team, {
    send: (name: string) => teamAfter(renameTeam({ path, body: { name } })),
    apply: withName,
  })
}
