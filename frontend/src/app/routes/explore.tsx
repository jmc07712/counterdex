import { useRef } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { ExploreFilters } from '@/features/teams/components/explore-filters'
import { ExploreTeams } from '@/features/teams/components/explore-teams'
import { NO_FILTERS, useExploreFilters } from '@/features/teams/hooks/use-explore-filters'
import { m } from '@/paraglide/messages.js'

export function ExplorePage() {
  const [filters, setFilters] = useExploreFilters()
  const search = useRef<HTMLInputElement>(null)

  function clearFilters() {
    setFilters(NO_FILTERS)
    // Clear filters goes with the empty state it's in, so focus moves to the search.
    search.current?.focus()
  }

  return (
    <>
      <PageHeader title={m.explore_title()} description={m.explore_description()} />
      <ExploreFilters filters={filters} onChange={setFilters} searchRef={search} />
      <ExploreTeams filters={filters} onClearFilters={clearFilters} />
    </>
  )
}
