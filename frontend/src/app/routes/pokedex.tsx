import { PageHeader } from '@/components/layout/page-header'
import { PokedexFilters } from '@/features/pokedex/components/pokedex-filters'
import { PokemonGrid } from '@/features/pokedex/components/pokemon-grid'
import { NO_FILTERS, usePokedexFilters } from '@/features/pokedex/hooks/use-pokedex-filters'
import { PokemonDetailsDialog } from '@/features/pokemon-details/components/pokemon-details-dialog'
import { useSelectedPokemon } from '@/features/pokemon-details/hooks/use-selected-pokemon'
import { SyncIndicator } from '@/features/sync-status/components/sync-indicator'

export function PokedexPage() {
  const [filters, setFilters] = usePokedexFilters()
  const selected = useSelectedPokemon()

  return (
    <>
      <PageHeader
        title="Pokédex"
        description="Every Pokémon with its types and base stats. Search, filter, and add any of them to a team."
        action={<SyncIndicator />}
      />
      <PokedexFilters filters={filters} onChange={setFilters} />
      <PokemonGrid
        filters={filters}
        onClearFilters={() => setFilters(NO_FILTERS)}
        onOpen={selected.open}
      />
      <PokemonDetailsDialog
        pokemonId={selected.selected}
        onSelect={selected.show}
        onClose={selected.close}
      />
    </>
  )
}
