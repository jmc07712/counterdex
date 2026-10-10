import { SearchX } from 'lucide-react'
import { useInView } from 'react-intersection-observer'
import { useDebounceValue } from 'usehooks-ts'

import { ListingStatus } from '@/api'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'

import { PokemonCard } from './pokemon-card'
import type { PokedexFilters } from './use-pokedex-filters'
import { usePokemonList } from './use-pokemon-list'

// Wait for a pause in typing before searching, so each keystroke isn't a request.
const SEARCH_DELAY_MS = 250
// Start loading the next page this far before the end of the list scrolls into view.
const PRELOAD_MARGIN = '800px'
const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'

type PokemonGridProps = {
  filters: PokedexFilters
  onClearFilters: () => void
}

export function PokemonGrid({ filters, onClearFilters }: PokemonGridProps) {
  const [search] = useDebounceValue(filters.search, SEARCH_DELAY_MS)
  const query = usePokemonList({ ...filters, search })
  const { ref: endOfList } = useInView({
    rootMargin: PRELOAD_MARGIN,
    onChange: (inView) => {
      if (inView && query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
    },
  })

  if (query.isPending) return <GridSkeleton />

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn’t load the Pokédex</AlertTitle>
        <AlertDescription>Check your connection and try again.</AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  const pokemon = query.data.pages.flatMap((page) => page.items)
  const removed = filters.status === ListingStatus.REMOVED

  if (pokemon.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>
            {removed ? 'No removed Pokémon' : 'No Pokémon match these filters'}
          </EmptyTitle>
          <EmptyDescription>
            {removed
              ? 'PokéAPI still lists every Pokémon these filters match.'
              : 'Try a shorter search, or fewer types.'}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <>
      <ul
        aria-busy={query.isPlaceholderData}
        className={`${GRID} transition-opacity duration-200 aria-busy:opacity-60`}
      >
        {pokemon.map((each, index) => (
          <li
            key={each.id}
            // Each page's cards are dealt in one after another.
            style={{ animationDelay: `${(index % 50) * 20}ms` }}
            className="animate-in duration-300 fill-mode-both fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
          >
            <PokemonCard pokemon={each} removed={removed} />
          </li>
        ))}
      </ul>

      {query.hasNextPage && (
        <div ref={endOfList} className="mt-8 flex justify-center">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </>
  )
}

function GridSkeleton() {
  return (
    <ul aria-label="Loading Pokémon" className={GRID}>
      {Array.from({ length: 12 }, (_, index) => (
        <li key={index}>
          <Skeleton className="aspect-[5/7] rounded-2xl" />
        </li>
      ))}
    </ul>
  )
}
