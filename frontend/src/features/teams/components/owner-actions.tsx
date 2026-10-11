import type { Team } from '@/api'

import { TeamMenu } from './team-menu'
import { TeamModeToggle } from './team-mode-toggle'

/** The owner's View / Edit toggle and team menu. */
export function OwnerActions({ team }: { team: Team }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <TeamModeToggle teamId={team.id} />
      <TeamMenu team={team} />
    </div>
  )
}
