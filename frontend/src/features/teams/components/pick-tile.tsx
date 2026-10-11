import type { ReactNode } from 'react'

import type { TeamMember } from '@/api'
import { cn } from '@/lib/utils'

import { memberColors, MUTED } from '../utils/member-colors'
import { MemberBall } from './member-ball'
import { MemberSprite } from './member-sprite'

type PickTileProps = {
  // The Pokémon, as the member it would be at its place in the list.
  member: TeamMember
  // Beside its sprite: its name and a line about it.
  children: ReactNode
}

/**
 * A Pokémon picked against a team, such as a counter's pick or a threat, as a tile in its main
 * type's color: its number in the list, then its sprite in front of its ghosted Poké Ball.
 */
export function PickTile({ member, children }: PickTileProps) {
  const colors = memberColors(member)
  return (
    <li
      style={{ backgroundColor: colors?.background, color: colors?.foreground }}
      className={cn(
        'group/hop relative isolate flex items-center gap-3 overflow-hidden rounded-2xl py-2 pr-3 pl-4',
        !colors && MUTED,
      )}
    >
      <span className="w-5 shrink-0 text-sm font-medium tabular-nums">{member.position + 1}</span>
      <span className="relative isolate grid size-16 shrink-0 place-items-center">
        <MemberBall member={member} className="absolute -inset-[8%] -z-10" />
        <MemberSprite member={member} className="scale-150" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">{children}</div>
    </li>
  )
}

type PickNameProps = { id?: string; children: string }

/** A pick's name, on its tile. */
export function PickName({ id, children }: PickNameProps) {
  return (
    <h3 id={id} className="max-w-full truncate text-lg font-extrabold">
      {children}
    </h3>
  )
}

type PickLineProps = { id?: string; children: string | null }

/** A line about a pick, on its tile, such as why it's there. */
export function PickLine({ id, children }: PickLineProps) {
  if (!children) return null
  return (
    <p id={id} className="text-sm leading-snug">
      {children}
    </p>
  )
}
