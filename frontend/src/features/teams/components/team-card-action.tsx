import { Plus } from 'lucide-react'

import type { Pokemon } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { Button } from '@/components/ui/button'
import { m } from '@/paraglide/messages.js'

import type { TeamEditor } from '../types'
import { addToTeam } from '../utils/add-to-team'
import { cantAdd } from '../utils/can-add'

type TeamCardActionProps = { editor: TeamEditor; pokemon: Pokemon }

/** On a Pokémon's card, a button to add it to the team, or why it can't join. */
export function TeamCardAction({ editor, pokemon }: TeamCardActionProps) {
  const reason = cantAdd(editor.team.members, pokemon)
  if (reason) return <p className="text-xs text-muted-foreground">{m.team_cant_add({ reason })}</p>
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={m.team_add_named({ name: displayName(pokemon.name) })}
      onClick={() => void addToTeam(editor, pokemon)}
      className="w-full"
    >
      <Plus aria-hidden="true" />
      {m.team_add()}
    </Button>
  )
}
