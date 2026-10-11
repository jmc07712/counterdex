import type { Team } from '@/api'

import type { TeamEditor } from '../types'
import { useAddTeamMember } from './use-add-team-member'
import { useRemoveTeamMember } from './use-remove-team-member'
import { useRenameTeam } from './use-rename-team'
import { useReorderTeam } from './use-reorder-team'
import { useReplaceTeamMember } from './use-replace-team-member'

/** A saved team, and each change its owner can make to it. */
export function useTeamEditor(team: Team): TeamEditor {
  return {
    team,
    add: useAddTeamMember(team),
    replace: useReplaceTeamMember(team),
    remove: useRemoveTeamMember(team),
    reorder: useReorderTeam(team),
    rename: useRenameTeam(team),
  }
}
