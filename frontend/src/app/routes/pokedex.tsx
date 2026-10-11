import { useRef } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { ResultsRegion } from '@/components/lists/results-region'
import { PokedexFilters } from '@/features/pokedex/components/pokedex-filters'
import { PokemonGrid } from '@/features/pokedex/components/pokemon-grid'
import { NO_FILTERS, usePokedexFilters } from '@/features/pokedex/hooks/use-pokedex-filters'
import { PokemonDetailsDialog } from '@/features/pokemon-details/components/pokemon-details-dialog'
import { useSelectedPokemon } from '@/features/pokemon-details/hooks/use-selected-pokemon'
import { useFocusAfterClearing } from '@/hooks/use-focus-after-clearing'
import { m } from '@/paraglide/messages.js'

export function PokedexPage() {
  const [filters, setFilters] = usePokedexFilters()
  const selected = useSelectedPokemon()
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
      <PageHeader title={m.pokedex_title()} description={m.pokedex_description()} />
      <PokedexFilters
        filters={filters}
        onChange={setFilters}
        onOpenPokemon={selected.open}
        searchRef={search}
      />
      <ResultsRegion ref={results}>
        <PokemonGrid filters={filters} onClearFilters={clearFilters} onOpen={selected.open} />
      </ResultsRegion>
      <PokemonDetailsDialog
        pokemonId={selected.selected}
        onSelect={selected.show}
        onClose={selected.close}
      />
    </>
  )
}
