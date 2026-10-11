import { PageHeader } from '@/components/layout/page-header'
import { PokedexFilters } from '@/features/pokedex/components/pokedex-filters'
import { PokemonGrid } from '@/features/pokedex/components/pokemon-grid'
import { NO_FILTERS, usePokedexFilters } from '@/features/pokedex/hooks/use-pokedex-filters'
import { PokemonDetailsDialog } from '@/features/pokemon-details/components/pokemon-details-dialog'
import { useSelectedPokemon } from '@/features/pokemon-details/hooks/use-selected-pokemon'
import { SyncIndicator } from '@/features/sync-status/components/sync-indicator'
import { m } from '@/paraglide/messages.js'

export function PokedexPage() {
  const [filters, setFilters] = usePokedexFilters()
  const selected = useSelectedPokemon()

  return (
    <>
      <PageHeader
        title={m.pokedex_title()}
        description={m.pokedex_description()}
        action={<SyncIndicator />}
      />
      <PokedexFilters filters={filters} onChange={setFilters} onOpenPokemon={selected.open} />
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
