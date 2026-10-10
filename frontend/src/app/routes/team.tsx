import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { PageHeader } from '@/components/layout/page-header'

export function TeamPage() {
  const { teamId } = useParams()

  return (
    <PageHeader title="Team" description={`Team ${teamId}`}>
      <Link
        to="/teams"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All teams
      </Link>
    </PageHeader>
  )
}
