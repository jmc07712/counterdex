import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { displayName } from '@/components/pokemon/format'
import { m } from '@/paraglide/messages.js'

import type { TeamEditor } from '../types'
import { ChangedThisWeekAlert } from './changed-this-week'
import { TeamNameField } from './team-name-field'
import { EmptySlots, SlotButton, TeamSlot, TeamSlots } from './team-slots'

type TeamBuilderProps = {
  editor: TeamEditor
  // Above the name, a BackLink.
  back: ReactNode
  // Beside the BackLink, such as a menu with Delete.
  actions?: ReactNode
  // Opens a member's details.
  onOpenPokemon: (pokemonId: number) => void
}

/** A team's name, edited in place, and its six slots, each member with a button to remove it. */
export function TeamBuilder({ editor, back, actions, onOpenPokemon }: TeamBuilderProps) {
  const { team } = editor
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        {back}
        {actions}
      </div>
      <div className="mb-6">
        <TeamNameField name={team.name} onRename={(name) => void editor.rename(name)} />
      </div>
      <ChangedThisWeekAlert members={team.members} className="mb-3" />
      <TeamSlots>
        {team.members.map((member) => (
          <TeamSlot
            key={member.pokemon.id}
            member={member}
            onOpen={() => onOpenPokemon(member.pokemon.id)}
          >
            <SlotButton
              aria-label={m.team_remove({ name: displayName(member.pokemon.name) })}
              onClick={() => void editor.remove(member.pokemon.id)}
            >
              <X />
            </SlotButton>
          </TeamSlot>
        ))}
        <EmptySlots filled={team.members.length} />
      </TeamSlots>
    </div>
  )
}
