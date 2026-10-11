import { toast } from 'sonner'

import type { Pokemon } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { m } from '@/paraglide/messages.js'

import type { TeamEditor } from '../types'

/** Adds a Pokémon to a team, then says so. */
export async function addToTeam(editor: TeamEditor, pokemon: Pokemon) {
  const team = await editor.add(pokemon)
  if (!team) return
  toast.success(m.team_added({ name: displayName(pokemon.name), team: team.name }))
}
