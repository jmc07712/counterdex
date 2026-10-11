import { useRef } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { PokedexFilters } from '@/features/pokedex/components/pokedex-filters'
import { PokemonGrid } from '@/features/pokedex/components/pokemon-grid'
import { NO_FILTERS, usePokedexFilters } from '@/features/pokedex/hooks/use-pokedex-filters'
import { PokemonDetailsDialog } from '@/features/pokemon-details/components/pokemon-details-dialog'
import { useSelectedPokemon } from '@/features/pokemon-details/hooks/use-selected-pokemon'
import { m } from '@/paraglide/messages.js'

export function PokedexPage() {
  const [filters, setFilters] = usePokedexFilters()
  const selected = useSelectedPokemon()
  const search = useRef<HTMLInputElement>(null)

  function clearFilters() {
    setFilters(NO_FILTERS)
    // Clear filters goes with the empty state it's in, so focus moves to the search.
    search.current?.focus()
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
      <PokemonGrid filters={filters} onClearFilters={clearFilters} onOpen={selected.open} />
      <PokemonDetailsDialog
        pokemonId={selected.selected}
        onSelect={selected.show}
        onClose={selected.close}
      />
    </>
  )
}
