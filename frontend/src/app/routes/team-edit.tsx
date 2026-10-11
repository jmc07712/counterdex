import { useParams } from 'react-router'

import type { Team } from '@/api'
import { PokemonDetailsDialog } from '@/features/pokemon-details/components/pokemon-details-dialog'
import { useSelectedPokemon } from '@/features/pokemon-details/hooks/use-selected-pokemon'
import { MyTeamsLink } from '@/features/teams/components/back-link'
import { OwnerActions } from '@/features/teams/components/owner-actions'
import { SavedTeam } from '@/features/teams/components/saved-team'
import { TeamBuilder } from '@/features/teams/components/team-builder'
import { useTeamEditor } from '@/features/teams/hooks/use-team-editor'

export function TeamEditPage() {
  const { teamId = '' } = useParams()
  const selected = useSelectedPokemon()

  return (
    <>
      <SavedTeam teamId={teamId} onOpenPokemon={selected.open}>
        {(team) => <EditTeam team={team} />}
      </SavedTeam>
      <PokemonDetailsDialog
        pokemonId={selected.selected}
        onSelect={selected.show}
        onClose={selected.close}
      />
    </>
  )
}

function EditTeam({ team }: { team: Team }) {
  const editor = useTeamEditor(team)
  return <TeamBuilder editor={editor} back={<MyTeamsLink />} actions={<OwnerActions team={team} />} />
}
