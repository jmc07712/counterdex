import { SearchX } from 'lucide-react'
import type { ReactNode } from 'react'

import { ListingStatus, type Pokemon } from '@/api'
import { DealtInItem, DealtInList } from '@/components/lists/dealt-in-item'
import { LoadMore } from '@/components/lists/load-more'
import { ResultsStatus } from '@/components/lists/results-status'
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

// Columns follow the width of the grid's container rather than the screen's, so the grid also fits
// beside something else, such as a team.
const GRID =
  'grid grid-cols-2 gap-3 sm:gap-4 @min-[36rem]:grid-cols-3 @min-[44rem]:grid-cols-4 @min-[60rem]:grid-cols-5 @min-[68rem]:grid-cols-6'

type PokemonGridProps = {
  filters: PokedexFilters
  onClearFilters: () => void
  onOpen: (pokemonId: number) => void
  // On each card of a Pokémon PokéAPI lists, such as a button to add it to a team.
  cardAction?: (pokemon: Pokemon) => ReactNode
}

export function PokemonGrid({ filters, onClearFilters, onOpen, cardAction }: PokemonGridProps) {
  const search = useDebouncedSearch(filters.search)
  const query = usePokemonList({ ...filters, search })

  // Wherever there's a status, it's the first thing returned, from the first load on, so it stays
  // the same element as the results change.
  if (query.isPending) {
    return (
      <>
        <ResultsStatus settled={false} />
        <GridSkeleton />
      </>
    )
  }

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
  const removed = view === ListingStatus.REMOVED
  const shown = pages.reduce((count, page) => count + page.items.length, 0)
  const settled = !query.isPlaceholderData

  if (shown === 0) {
    return (
      <>
        <ResultsStatus settled={settled}>{m.pokedex_nothing_found_title({ view })}</ResultsStatus>
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
              {m.common_clear_filters()}
            </Button>
          </EmptyContent>
        </Empty>
      </>
    )
  }

  return (
    <>
      <ResultsStatus settled={settled}>
        {query.hasNextPage
          ? m.pokedex_shown_more({ count: shown })
          : m.pokedex_shown({ count: shown })}
      </ResultsStatus>
      <div className="@container">
        <DealtInList
          aria-busy={query.isPlaceholderData}
          className={`${GRID} transition-opacity duration-200 aria-busy:opacity-60`}
        >
          {pages.flatMap((page) =>
            page.items.map((each, index) => (
              <DealtInItem key={each.id} index={index}>
                <PokemonCard
                  pokemon={each}
                  removed={removed}
                  onOpen={() => onOpen(each.id)}
                  action={removed ? undefined : cardAction?.(each)}
                />
              </DealtInItem>
            )),
          )}
        </DealtInList>
      </div>

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
    <div className="@container">
      <ul aria-label={m.pokedex_loading()} className={GRID}>
        {Array.from({ length: 12 }, (_, index) => (
          <li key={index}>
            <Skeleton className="aspect-[5/7] rounded-2xl" />
          </li>
        ))}
      </ul>
    </div>
  )
}
