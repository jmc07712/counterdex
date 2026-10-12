import { Plus } from 'lucide-react'
import { Link } from 'react-router'

import { PokeBall } from '@/components/pokemon/poke-ball'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { ENTER, useEnterDelay } from '../hooks/use-enter-delay'
import { MAX_TEAM_SIZE } from '../utils/can-add'
import { ROW, SlotNumber } from './team-slots'

type EmptySlotsProps = {
  filled: number
  // Where each empty slot links to be filled, such as the team's Edit page. Without it, the slots
  // don't link.
  to?: string
}

/** The slots after the team's `filled` members, each dashed: "Empty slot", or a link to fill it. */
export function EmptySlots({ filled, to }: EmptySlotsProps) {
  return Array.from({ length: MAX_TEAM_SIZE - filled }, (_, index) => (
    <EmptySlot key={filled + index} slot={filled + index} to={to} />
  ))
}

function EmptySlot({ slot, to }: { slot: number; to?: string }) {
  const delay = useEnterDelay(slot)
  return (
    <li
      style={{ animationDelay: `${delay}ms` }}
      className={cn(ENTER, 'rounded-2xl border-2 border-dashed text-sm text-muted-foreground')}
    >
      {to ? (
        <Link
          to={to}
          aria-label={m.team_add_to_slot({ slot: slot + 1 })}
          className={cn(
            ROW,
            'h-full rounded-[inherit] transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
          )}
        >
          <SlotNumber slot={slot} />
          <EmptyBall />
          <span className="flex items-center gap-1.5 font-medium">
            <Plus className="size-4" aria-hidden="true" />
            {m.team_add_pokemon()}
          </span>
        </Link>
      ) : (
        <div className={cn(ROW, 'h-full')}>
          <SlotNumber slot={slot} />
          <EmptyBall />
          {m.team_empty_slot()}
        </div>
      )}
    </li>
  )
}

// As large as a member's sprite in a row as wide.
function EmptyBall() {
  return (
    <span className="grid size-16 shrink-0 place-items-center @max-[34rem]/slots:size-12">
      <PokeBall className="size-9 opacity-50 @max-[34rem]/slots:size-7" />
    </span>
  )
}
