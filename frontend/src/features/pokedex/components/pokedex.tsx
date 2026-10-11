import { type ReactNode, useRef } from 'react'

import type { Pokemon } from '@/api'
import { ResultsRegion } from '@/components/lists/results-region'
import { useFocusAfterClearing } from '@/hooks/use-focus-after-clearing'

import { NO_FILTERS, usePokedexFilters } from '../hooks/use-pokedex-filters'
import { PokedexFilters } from './pokedex-filters'
import { PokemonGrid } from './pokemon-grid'

type PokedexProps = {
  onOpenPokemon: (pokemonId: number) => void
  // On each card of a Pokémon PokéAPI lists, such as a button to add it to a team.
  cardAction?: (pokemon: Pokemon) => ReactNode
}

/** The Pokédex's filters, kept in the URL, above the grid of Pokémon they find. */
export function Pokedex({ onOpenPokemon, cardAction }: PokedexProps) {
  const [filters, setFilters] = usePokedexFilters()
  const search = useRef<HTMLInputElement>(null)
  const results = useRef<HTMLElement>(null)
  const focusAfterClearing = useFocusAfterClearing(search, results)

  function clearFilters() {
    setFilters(NO_FILTERS)
    // The button leaves with the empty state, so focus would fall to the page.
    focusAfterClearing()
  }

  return (
    <>
      <PokedexFilters
        filters={filters}
        onChange={setFilters}
        onOpenPokemon={onOpenPokemon}
        searchRef={search}
      />
      <ResultsRegion ref={results}>
        <PokemonGrid
          filters={filters}
          onClearFilters={clearFilters}
          onOpen={onOpenPokemon}
          cardAction={cardAction}
        />
      </ResultsRegion>
    </>
  )
}
