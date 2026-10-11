import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

/** A quiet invitation, under someone else's team, to build one of your own. */
export function BuildYourOwnTeam() {
  return (
    <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
      <p className="text-sm text-muted-foreground">{m.teams_empty_description({ scope: 'mine' })}</p>
      <Button asChild variant="outline" size="sm">
        <Link to={paths.home.getHref({ scope: 'mine' })}>{m.team_build_your_own()}</Link>
      </Button>
    </div>
  )
}
