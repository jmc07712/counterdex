import { useParams } from 'react-router'

import { PokemonDetailsDialog } from '@/features/pokemon-details/components/pokemon-details-dialog'
import { useSelectedPokemon } from '@/features/pokemon-details/hooks/use-selected-pokemon'
import { OwnTeamParty } from '@/features/teams/components/own-team-party'
import { SavedTeam } from '@/features/teams/components/saved-team'

export function TeamPage() {
  const { teamId = '' } = useParams()
  const selected = useSelectedPokemon()

  return (
    <>
      <SavedTeam teamId={teamId} onOpenPokemon={selected.open}>
        {(team) => <OwnTeamParty team={team} onOpenPokemon={selected.open} />}
      </SavedTeam>
      <PokemonDetailsDialog
        pokemonId={selected.selected}
        onSelect={selected.show}
        onClose={selected.close}
      />
    </>
  )
}
