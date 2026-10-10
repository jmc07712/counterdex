import { PageHeader } from '@/components/page-header'
import { PokedexFilters } from '@/features/pokedex/pokedex-filters'
import { PokemonGrid } from '@/features/pokedex/pokemon-grid'
import { NO_FILTERS, usePokedexFilters } from '@/features/pokedex/use-pokedex-filters'

export function PokedexPage() {
  const [filters, setFilters] = usePokedexFilters()

  return (
    <>
      <PageHeader
        title="Pokédex"
        description="Every Pokémon with its types and base stats. Search, filter, and add any of them to a team."
      />
      <PokedexFilters filters={filters} onChange={setFilters} />
      <PokemonGrid filters={filters} onClearFilters={() => setFilters(NO_FILTERS)} />
    </>
  )
}
