import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { PageHeader } from '@/components/layout/page-header'
import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

export function TeamPage() {
  const { teamId } = useParams()

  return (
    <PageHeader title={m.team_title()} description={m.team_description({ teamId: teamId ?? '' })}>
      <Link
        to={paths.home.getHref()}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {m.team_all_teams()}
      </Link>
    </PageHeader>
  )
}
