import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  type Modifier,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { type ReactNode, useRef } from 'react'

import type { TeamMember } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { m } from '@/paraglide/messages.js'

// A slot moves only up and down its column.
const alongColumn: Modifier = ({ transform }) => ({ ...transform, x: 0 })

type SortableMembersProps = {
  members: TeamMember[]
  // Called with the members' Pokémon ids in their new order once a slot is dropped in another's.
  onReorder: (pokemonIds: number[]) => void
  // The slots: a SortableTeamSlot for each member, then any empty slots.
  children: ReactNode
}

/**
 * Lets each member's SortableTeamSlot be dragged to another member's slot: with a mouse once it
 * has moved a few pixels, so a click still opens the member; with a finger, at once from its
 * handle, or elsewhere once held still for a moment, so a swipe still scrolls; or from its handle
 * with the keyboard. A screen reader hears where the slot is picked up, moved and dropped.
 */
export function SortableMembers({ members, onReorder, children }: SortableMembersProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
      bypassActivationConstraint: ({ event, activeNode }) =>
        event.target instanceof Node && !!activeNode.activatorNode.current?.contains(event.target),
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const ids = members.map((member) => member.pokemon.id)
  // The slot a dragged member was last said to be in, so a move within it isn't said again.
  const saidSlot = useRef(0)

  const slotOf = (id: UniqueIdentifier) => ids.indexOf(Number(id)) + 1
  const nameOf = (id: UniqueIdentifier) =>
    displayName(members.find((member) => member.pokemon.id === Number(id))?.pokemon.name ?? '')

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || over.id === active.id) return
    onReorder(arrayMove(ids, slotOf(active.id) - 1, slotOf(over.id) - 1))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[alongColumn]}
      onDragEnd={handleDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: m.team_move_instructions() },
        announcements: {
          onDragStart: ({ active }) => {
            saidSlot.current = slotOf(active.id)
            return m.team_move_picked_up({
              name: nameOf(active.id),
              slot: slotOf(active.id),
              count: ids.length,
            })
          },
          onDragOver: ({ active, over }) => {
            if (!over || slotOf(over.id) === saidSlot.current) return undefined
            saidSlot.current = slotOf(over.id)
            return m.team_move_over({ name: nameOf(active.id), slot: slotOf(over.id) })
          },
          onDragEnd: ({ active, over }) =>
            over
              ? m.team_move_dropped({ name: nameOf(active.id), slot: slotOf(over.id) })
              : undefined,
          onDragCancel: ({ active }) =>
            m.team_move_cancelled({ name: nameOf(active.id), slot: slotOf(active.id) }),
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}
