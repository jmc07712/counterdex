import { PageHeader } from '@/components/page-header'
import { PokedexFilters } from '@/features/pokedex/pokedex-filters'
import { PokemonDetailsDialog } from '@/features/pokedex/pokemon-details-dialog'
import { PokemonGrid } from '@/features/pokedex/pokemon-grid'
import { SyncIndicator } from '@/features/pokedex/sync-indicator'
import { NO_FILTERS, usePokedexFilters } from '@/features/pokedex/use-pokedex-filters'
import { useSelectedPokemon } from '@/features/pokedex/use-selected-pokemon'

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
