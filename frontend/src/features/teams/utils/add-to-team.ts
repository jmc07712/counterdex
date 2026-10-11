import { toast } from 'sonner'

import type { Pokemon } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { m } from '@/paraglide/messages.js'

import type { TeamEditor } from '../types'

/**
 * Adds a Pokémon to a team, then says so, with `view` as an action if given. If an earlier or
 * later stage of its evolution line is on the team, says that instead, offering to put the new
 * Pokémon in that one's slot.
 */
export async function addToTeam(
  editor: TeamEditor,
  pokemon: Pokemon,
  { teamName, view }: { teamName: string; view?: () => void },
) {
  const team = await editor.add(pokemon)
  if (!team) return
  const added = team.members.find((member) => member.pokemon.id === pokemon.id)
  const related = team.members.find(
    (member) => member.pokemon.id === added?.related_pokemon_ids[0],
  )
  if (related) {
    const relatedName = displayName(related.pokemon.name)
    toast(m.team_related_notice({ related: relatedName, team: teamName }), {
      action: {
        label: m.team_replace({ name: relatedName }),
        onClick: () => void editor.replace(related.pokemon.id, pokemon),
      },
    })
    return
  }
  toast.success(m.team_added({ name: displayName(pokemon.name), team: teamName }), {
    action: view && { label: m.team_view(), onClick: view },
  })
}
