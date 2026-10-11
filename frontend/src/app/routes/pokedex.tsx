import { PageHeader } from '@/components/layout/page-header'
import { Pokedex } from '@/features/pokedex/components/pokedex'
import { PokemonDetailsDialog } from '@/features/pokemon-details/components/pokemon-details-dialog'
import { useSelectedPokemon } from '@/features/pokemon-details/hooks/use-selected-pokemon'
import { AddToTeamMenu } from '@/features/teams/components/add-to-team-menu'
import { m } from '@/paraglide/messages.js'

export function PokedexPage() {
  const selected = useSelectedPokemon()

  return (
    <>
      <PageHeader title={m.pokedex_title()} description={m.pokedex_description()} />
      <Pokedex
        onOpenPokemon={selected.open}
        cardAction={(pokemon) => <AddToTeamMenu pokemon={pokemon} className="w-full" />}
      />
      <PokemonDetailsDialog
        pokemonId={selected.selected}
        onSelect={selected.show}
        onClose={selected.close}
        action={(pokemon) => <AddToTeamMenu pokemon={pokemon} />}
      />
    </>
  )
}
