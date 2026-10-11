import { Eye, Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

/** The owner's switch between a team's party and its builder: two links, the current one marked. */
export function TeamModeToggle({ teamId }: { teamId: string }) {
  return (
    <div role="group" aria-label={m.team_mode()} className="flex shrink-0 rounded-lg bg-muted p-0.5">
      <ModeLink to={paths.team.getHref(teamId)} icon={<Eye aria-hidden="true" />}>
        {m.team_mode_view()}
      </ModeLink>
      <ModeLink to={paths.teamEdit.getHref(teamId)} icon={<Pencil aria-hidden="true" />}>
        {m.team_mode_edit()}
      </ModeLink>
    </div>
  )
}

type ModeLinkProps = { to: string; icon: ReactNode; children: string }

// Marked aria-current="page" by NavLink on its own page only; `end` keeps the team's page from
// matching its Edit page too.
function ModeLink({ to, icon, children }: ModeLinkProps) {
  return (
    <NavLink
      end
      to={to}
      className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-background aria-[current=page]:text-foreground aria-[current=page]:shadow-sm sm:px-2.5 [&_svg]:size-4"
    >
      {icon}
      {/* Icons alone on phones, where the header is narrow; the words still name the link. */}
      <span className="sr-only sm:not-sr-only">{children}</span>
    </NavLink>
  )
}
