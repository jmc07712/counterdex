import { toast } from 'sonner'

import type { Pokemon } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { m } from '@/paraglide/messages.js'

import type { TeamEditor } from '../types'

/** Adds a Pokémon to a team, then says so, with `view` as an action if given. */
export async function addToTeam(
  editor: TeamEditor,
  pokemon: Pokemon,
  { teamName, view }: { teamName: string; view?: () => void },
) {
  const team = await editor.add(pokemon)
  if (!team) return
  toast.success(m.team_added({ name: displayName(pokemon.name), team: teamName }), {
    action: view && { label: m.team_view(), onClick: view },
  })
}
