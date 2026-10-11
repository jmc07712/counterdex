import { useQuery } from '@tanstack/react-query'

import type { TeamMember } from '@/api'
import { listPokemonChangesOptions } from '@/api/@tanstack/react-query.gen'

/**
 * The newest change a sync found to a member's Pokémon, if it changed recently and is still in the
 * Pokédex; a removed member's newest change is its removal, which its slot already shows. Only
 * then are its changes fetched, into the cache entry the Pokémon's details use for its history.
 */
export function useNewestChange(member: TeamMember) {
  const shown = member.pokemon.changed_recently && !member.removed_at
  const changes = useQuery({
    ...listPokemonChangesOptions({ path: { pokemon_id: member.pokemon.id } }),
    enabled: shown,
  })
  return {
    loading: shown && changes.isLoading,
    // Undefined while it loads, if it can't load, or if it isn't shown.
    newest: shown ? changes.data?.[0] : undefined,
  }
}
