import { type Pokemon, replaceTeamMember, type Team } from '@/api'

import { withReplaced } from '../utils/changed-team'
import { teamAfter } from '../utils/team-change-error'
import { useTeamChange } from './use-team-change'

type Replacement = { pokemonId: number; pokemon: Pokemon }

/** Puts `pokemon` in the slot of the member `pokemonId`. */
export function useReplaceTeamMember(team: Team) {
  const replace = useTeamChange(team, {
    send: ({ pokemonId, pokemon }: Replacement) =>
      teamAfter(
        replaceTeamMember({
          path: { team_id: team.id, pokemon_id: pokemonId },
          body: { pokemon_id: pokemon.id },
        }),
      ),
    apply: (shown, { pokemonId, pokemon }) => withReplaced(shown, pokemonId, pokemon),
  })
  return (pokemonId: number, pokemon: Pokemon) => replace({ pokemonId, pokemon })
}
