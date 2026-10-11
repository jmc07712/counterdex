import { PageHeader } from '@/components/layout/page-header'
import { ExploreTeams } from '@/features/teams/components/explore-teams'
import { m } from '@/paraglide/messages.js'

export function ExplorePage() {
  return (
    <>
      <PageHeader title={m.explore_title()} description={m.explore_description()} />
      <ExploreTeams />
    </>
  )
}
