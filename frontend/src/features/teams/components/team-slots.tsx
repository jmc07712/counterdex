import type { ReactNode } from 'react'

import type { TeamMember } from '@/api'
import { ChangedMark } from '@/components/pokemon/changed-mark'
import { displayName } from '@/components/pokemon/format'
import { TYPE_STYLES } from '@/components/pokemon/pokemon-types'
import { TypeBadges } from '@/components/pokemon/type-badges'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { MAX_TEAM_SIZE } from '../utils/can-add'

const ROW = 'flex min-h-16 items-center gap-3 rounded-xl px-3 py-2'

/** A team's six slots, in battle order: its members' rows, then EmptySlots. */
export function TeamSlots({ children }: { children: ReactNode }) {
  return (
    <ol aria-label={m.team_slots()} className="flex flex-col gap-2">
      {children}
    </ol>
  )
}

function SlotNumber({ number }: { number: number }) {
  return <span className="w-4 shrink-0 text-sm text-muted-foreground tabular-nums">{number}</span>
}

type TeamSlotProps = {
  member: TeamMember
  // At the end of the row, such as a button to remove the member.
  children?: ReactNode
}

export function TeamSlot({ member, children }: TeamSlotProps) {
  const { pokemon, removed_at } = member
  return (
    <li
      style={{ '--type': TYPE_STYLES[pokemon.types[0]].background }}
      className={cn(ROW, 'border bg-card', removed_at && 'text-muted-foreground')}
    >
      <SlotNumber number={member.position + 1} />
      <span
        className={cn(
          'grid size-12 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--type)_28%,var(--color-card))]',
          removed_at && 'grayscale',
        )}
      >
        {pokemon.sprite_url && (
          <img
            src={pokemon.sprite_url}
            alt=""
            width={48}
            height={48}
            className="size-12 scale-110 [image-rendering:pixelated]"
          />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex items-center gap-1 font-semibold">
          <span className="truncate">{displayName(pokemon.name)}</span>
          {pokemon.changed_recently && <ChangedMark />}
        </p>
        {removed_at ? (
          <p className="text-xs">{m.team_removed_from_pokedex()}</p>
        ) : (
          <TypeBadges types={pokemon.types} />
        )}
      </div>
      {children}
    </li>
  )
}

/** The slots after the team's `filled` members, each a quiet "Empty slot". */
export function EmptySlots({ filled }: { filled: number }) {
  return Array.from({ length: MAX_TEAM_SIZE - filled }, (_, index) => (
    <li
      key={filled + index}
      className={cn(ROW, 'border border-dashed text-sm text-muted-foreground')}
    >
      <SlotNumber number={filled + index + 1} />
      {m.team_empty_slot()}
    </li>
  ))
}
