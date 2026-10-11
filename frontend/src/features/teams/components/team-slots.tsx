import { Plus } from 'lucide-react'

import type { TeamMember } from '@/api'
import { m } from '@/paraglide/messages.js'

import { MAX_TEAM_SIZE } from '../utils/can-add'
import { TeamSlot } from './team-slot'

type TeamSlotsProps = {
  members: TeamMember[]
  onRemove: (pokemonId: number) => void
  onAdd: () => void
}

const SLOTS_GRID = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'

export function TeamSlots({ members, onRemove, onAdd }: TeamSlotsProps) {
  const empty = MAX_TEAM_SIZE - members.length
  return (
    <ol aria-label={m.team_slots()} className={SLOTS_GRID}>
      {members.map((member) => (
        <li key={member.pokemon.id}>
          <TeamSlot member={member} onRemove={() => onRemove(member.pokemon.id)} />
        </li>
      ))}
      {Array.from({ length: empty }, (_, index) => (
        <li key={`empty-${index}`}>
          <button
            type="button"
            onClick={onAdd}
            className="flex h-full min-h-[5.5rem] w-full items-center justify-center gap-2 rounded-2xl border border-dashed text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Plus className="size-4" aria-hidden="true" />
            {m.team_add_to_slot({ number: members.length + index + 1 })}
          </button>
        </li>
      ))}
    </ol>
  )
}
