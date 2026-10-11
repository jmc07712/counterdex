import { X } from 'lucide-react'
import { type ReactNode, useRef } from 'react'

import type { TeamMember } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { m } from '@/paraglide/messages.js'

import type { TeamEditor } from '../types'
import { ChangedThisWeekAlert } from './changed-this-week'
import { ReplaceBanner } from './replace-banner'
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
  // The member a Pokémon is being chosen to replace, if any.
  replacing?: TeamMember
  onCancelReplacing: () => void
}

/**
 * A team's name, edited in place, and its six slots, each member with a button to remove it. While
 * a member is being replaced, a box above the slots says so.
 */
export function TeamBuilder({
  editor,
  back,
  actions,
  onOpenPokemon,
  replacing,
  onCancelReplacing,
}: TeamBuilderProps) {
  const { team } = editor
  const slots = useRef<HTMLOListElement>(null)

  function cancelReplacing() {
    onCancelReplacing()
    // Cancel leaves with its box, so focus would fall to the page.
    slots.current?.focus()
  }

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
      {replacing && (
        <ReplaceBanner member={replacing} onCancel={cancelReplacing} className="mb-3" />
      )}
      <TeamSlots ref={slots}>
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
