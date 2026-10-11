import { SearchX } from 'lucide-react'

import { ListingStatus } from '@/api'
import { DealtInItem } from '@/components/lists/dealt-in-item'
import { LoadMore } from '@/components/lists/load-more'
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

const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'

type PokemonGridProps = {
  filters: PokedexFilters
  onClearFilters: () => void
  onOpen: (pokemonId: number) => void
}

export function PokemonGrid({ filters, onClearFilters, onOpen }: PokemonGridProps) {
  const search = useDebouncedSearch(filters.search)
  const query = usePokemonList({ ...filters, search })

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

  const { pages } = query.data
  const { view } = filters

  if (pages.every((page) => page.items.length === 0)) {
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
        {pages.flatMap((page) =>
          page.items.map((each, index) => (
            <DealtInItem key={each.id} index={index}>
              <PokemonCard
                pokemon={each}
                removed={view === ListingStatus.REMOVED}
                onOpen={() => onOpen(each.id)}
              />
            </DealtInItem>
          )),
        )}
      </ul>

      {query.hasNextPage && (
        <LoadMore
          loading={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
        />
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
