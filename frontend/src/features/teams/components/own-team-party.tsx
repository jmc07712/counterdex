import type { Team } from '@/api'
import { paths } from '@/config/paths'

import { MyTeamsLink } from './back-link'
import { OwnerActions } from './owner-actions'
import { TeamParty } from './team-party'

type OwnTeamPartyProps = { team: Team; onOpenPokemon: (pokemonId: number) => void }

/**
 * A team's party as its owner sees it: with the View / Edit toggle and team menu, empty slots that
 * link to Edit, and a Replace link on each member removed from the Pokédex.
 */
export function OwnTeamParty({ team, onOpenPokemon }: OwnTeamPartyProps) {
  return (
    <TeamParty
      team={team}
      onOpenPokemon={onOpenPokemon}
      back={<MyTeamsLink />}
      actions={<OwnerActions team={team} />}
      emptySlotsTo={paths.teamEdit.getHref(team.id)}
      replaceTo={(pokemonId) => paths.teamEdit.getHref(team.id, { replace: pokemonId })}
    />
  )
}
