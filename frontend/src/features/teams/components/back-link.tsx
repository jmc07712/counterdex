import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'

import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

type BackLinkProps = { to: string; children: string }

/** A quiet link above a page's heading, back to where the page was opened from. */
export function BackLink({ to, children }: BackLinkProps) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {children}
    </Link>
  )
}

/** The BackLink on a team's pages for its owner, from either mode: to their own teams. */
export function MyTeamsLink() {
  return <BackLink to={paths.home.getHref({ scope: 'mine' })}>{m.teams_mine()}</BackLink>
}
