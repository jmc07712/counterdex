import { SearchX } from 'lucide-react'
import { useInView } from 'react-intersection-observer'

import { ListingStatus } from '@/api'
import { PokemonCard } from '@/components/pokemon/pokemon-card'
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
import { useDebouncedSearch } from '@/hooks/use-debounced-search'
import { m } from '@/paraglide/messages.js'

import type { PokedexFilters } from '../hooks/use-pokedex-filters'
import { usePokemonList } from '../hooks/use-pokemon-list'

const PRELOAD_MARGIN = '800px'
const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'

type PokemonGridProps = {
  filters: PokedexFilters
  onClearFilters: () => void
  onOpen: (pokemonId: number) => void
}

export function PokemonGrid({ filters, onClearFilters, onOpen }: PokemonGridProps) {
  const search = useDebouncedSearch(filters.search)
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
        <AlertTitle>{m.pokedex_load_failed()}</AlertTitle>
        <AlertDescription>{m.common_check_connection()}</AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            {m.common_try_again()}
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  const pokemon = query.data.pages.flatMap((page) => page.items)
  const { view } = filters

  if (pokemon.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>{m.pokedex_nothing_found_title({ view })}</EmptyTitle>
          <EmptyDescription>{m.pokedex_nothing_found_description({ view })}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={onClearFilters}>
            {m.pokedex_clear_filters()}
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
            <PokemonCard
              pokemon={each}
              removed={view === ListingStatus.REMOVED}
              onOpen={() => onOpen(each.id)}
            />
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
            {query.isFetchingNextPage ? m.pokedex_loading_more() : m.pokedex_load_more()}
          </Button>
        </div>
      )}
    </>
  )
}

function GridSkeleton() {
  return (
    <ul aria-label={m.pokedex_loading()} className={GRID}>
      {Array.from({ length: 12 }, (_, index) => (
        <li key={index}>
          <Skeleton className="aspect-[5/7] rounded-2xl" />
        </li>
      ))}
    </ul>
  )
}
