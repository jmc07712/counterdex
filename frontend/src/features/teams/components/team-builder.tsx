import { X } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'

import type { TeamMember } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { m } from '@/paraglide/messages.js'

import { useDroppedOrder } from '../hooks/use-dropped-order'
import type { TeamEditor } from '../types'
import { ChangedThisWeekAlert } from './changed-this-week'
import { ReplaceBanner } from './replace-banner'
import { SortableMembers } from './sortable-members'
import { TeamNameField } from './team-name-field'
import { EmptySlots, ReplaceLink, SlotButton, SortableTeamSlot, TeamSlots } from './team-slots'

type TeamBuilderProps = {
  editor: TeamEditor
  // Above the name, a BackLink.
  back: ReactNode
  // Beside the BackLink, such as a menu with Delete.
  actions?: ReactNode
  // The list of slots, which focus can be moved to.
  slotsRef: RefObject<HTMLOListElement | null>
  // Opens a member's details.
  onOpenPokemon: (pokemonId: number) => void
  // Where a member removed from the Pokédex links to be replaced.
  replaceTo: (pokemonId: number) => string
  // The member a Pokémon is being chosen to replace, if any.
  replacing?: TeamMember
  onCancelReplacing: () => void
}

/**
 * A team's name, edited in place, and its six slots, each member with a button to remove it and a
 * handle to drag it to another member's slot, and each member removed from the Pokédex with a
 * Replace link. While a member is being replaced, a box above the slots says so.
 */
export function TeamBuilder({
  editor,
  back,
  actions,
  slotsRef,
  onOpenPokemon,
  replaceTo,
  replacing,
  onCancelReplacing,
}: TeamBuilderProps) {
  const { team } = editor
  const [ordered, showOrder] = useDroppedOrder(team)

  function reorder(pokemonIds: number[]) {
    showOrder(pokemonIds)
    void editor.reorder(pokemonIds)
  }

  function cancelReplacing() {
    onCancelReplacing()
    // Cancel leaves with its box, so focus would fall to the page.
    slotsRef.current?.focus()
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
      <SortableMembers members={ordered.members} onReorder={reorder}>
        <TeamSlots ref={slotsRef}>
          {ordered.members.map((member) => (
            <SortableTeamSlot
              key={member.pokemon.id}
              member={member}
              onOpen={() => onOpenPokemon(member.pokemon.id)}
            >
              {member.removed_at && (
                <ReplaceLink member={member} to={replaceTo(member.pokemon.id)} />
              )}
              <SlotButton
                aria-label={m.team_remove({ name: displayName(member.pokemon.name) })}
                onClick={() => void editor.remove(member.pokemon.id)}
              >
                <X />
              </SlotButton>
            </SortableTeamSlot>
          ))}
          <EmptySlots filled={ordered.members.length} />
        </TeamSlots>
      </SortableMembers>
    </div>
  )
}
