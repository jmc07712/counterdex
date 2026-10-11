import { PageHeader } from '@/components/layout/page-header'
import { ExploreFilters } from '@/features/teams/components/explore-filters'
import { ExploreTeams } from '@/features/teams/components/explore-teams'
import { NO_FILTERS, useExploreFilters } from '@/features/teams/hooks/use-explore-filters'
import { m } from '@/paraglide/messages.js'

export function ExplorePage() {
  const [filters, setFilters] = useExploreFilters()

  return (
    <>
      <PageHeader title={m.explore_title()} description={m.explore_description()} />
      <ExploreFilters filters={filters} onChange={setFilters} />
      <ExploreTeams filters={filters} onClearFilters={() => setFilters(NO_FILTERS)} />
    </>
  )
}
