import type { ComponentProps } from 'react'

import { ChangeKind, type Stats, type TeamMember } from '@/api'
import { BaseStats } from '@/components/pokemon/base-stats'
import { ChangeDot } from '@/components/pokemon/change-entry'
import { ChangedMark } from '@/components/pokemon/changed-mark'
import { dexNumber, displayName, MAX_STAT_TOTAL, statTotal } from '@/components/pokemon/format'
import { TypeBadges } from '@/components/pokemon/type-badges'
import { Progress } from '@/components/ui/progress'
import { formatDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { ENTER, useEnterDelay } from '../hooks/use-enter-delay'
import { memberColors, MUTED } from '../utils/member-colors'
import { MemberBall } from './member-ball'
import { MemberSprite } from './member-sprite'

// A sprite pops out of its Poké Ball this long after its slot starts to enter.
const POP_OUT_AFTER_MS = 150

type MemberPanelProps = { member: TeamMember } & ComponentProps<'li'>

/** A member's slot, painted in its main type, or neutral once it's no longer in the Pokédex. */
export function MemberPanel({ member, style, className, children, ...props }: MemberPanelProps) {
  const colors = memberColors(member)
  const delay = useEnterDelay(member.position)
  return (
    <li
      {...props}
      style={{
        backgroundColor: colors?.background,
        color: colors?.foreground,
        animationDelay: `${delay}ms`,
        ...style,
      }}
      className={cn(
        'group/hop relative isolate overflow-hidden',
        ENTER,
        !colors && MUTED,
        className,
      )}
    >
      {children}
    </li>
  )
}

type PartOfMemberProps = { member: TeamMember; className?: string }

/** The member's sprite in front of its ghosted Poké Ball, popping out of it as the slot enters. */
export function PanelSprite({ member, className }: PartOfMemberProps) {
  const delay = useEnterDelay(member.position)
  return (
    <div className={cn('relative isolate grid shrink-0 place-items-center', className)}>
      <MemberBall member={member} className="absolute -inset-[8%] -z-10" />
      <div
        style={{ animationDelay: `${delay + POP_OUT_AFTER_MS}ms` }}
        className="size-full animate-in duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] fill-mode-both zoom-in-0 motion-reduce:animate-none"
      >
        <MemberSprite member={member} className="scale-150" />
      </div>
    </div>
  )
}

/** The member's name, as its slot's heading. */
export function MemberName({ member, id, className }: PartOfMemberProps & { id: string }) {
  return (
    <h2 id={id} className={cn('max-w-full font-bold', className)}>
      {displayName(member.pokemon.name)}
    </h2>
  )
}

/** The member's Pokédex number, marked if a sync changed it recently. */
export function MemberNumber({ member, className }: PartOfMemberProps) {
  return (
    <p className={cn('flex items-center gap-1 text-xs font-medium tabular-nums', className)}>
      {dexNumber(member.pokemon.id)}
      {member.pokemon.changed_recently && <ChangedMark className="text-current" />}
    </p>
  )
}

/**
 * Its types, ringed so a badge in the panel's own color still shows; or, for a member removed from
 * the Pokédex, the date it was removed. A removal from this week is the member's change, so it
 * gets the dot the Pokédex's change history marks a removal with.
 */
export function MemberTypes({ member }: PartOfMemberProps) {
  if (member.removed_at) {
    return (
      <p className="text-xs">
        {member.pokemon.changed_recently && (
          <ChangeDot
            kind={ChangeKind.REMOVED}
            className="mr-1.5 inline-block size-2.5 align-[-0.0625rem]"
          />
        )}
        {m.team_removed_on({ date: formatDate(member.removed_at) })}
      </p>
    )
  }
  return (
    <TypeBadges
      types={member.pokemon.types}
      className="*:*:data-[slot=badge]:ring-2 *:*:data-[slot=badge]:ring-white/80"
    />
  )
}

type StatsProps = { stats: Stats; className?: string }

/** The base stats in the panel's text color: labels, values and bars, on a faint track. */
export function PanelStats({ stats, className }: StatsProps) {
  return (
    <BaseStats
      stats={stats}
      className={cn(
        '[--type-1:currentColor] [&_[data-slot=progress]]:bg-current/20 [&_dt]:text-current',
        className,
      )}
    />
  )
}

/** The base stat total, with a bar against MAX_STAT_TOTAL that a total past it fills. */
export function TotalBar({ stats, className }: StatsProps) {
  const total = statTotal(stats)
  return (
    <dl className={cn('flex items-center gap-1.5 text-xs', className)}>
      <dt>{m.pokemon_stat_total()}</dt>
      <dd className="flex items-center gap-2">
        <span className="w-7 font-bold tabular-nums">{total}</span>
        <Progress
          aria-hidden="true"
          value={Math.min(total / MAX_STAT_TOTAL, 1) * 100}
          className="h-1.5 w-16 bg-current/20 *:data-[slot=progress-indicator]:bg-current"
        />
      </dd>
    </dl>
  )
}
