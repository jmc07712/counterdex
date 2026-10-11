import type { ComponentProps, ReactNode } from 'react'

import type { TeamMember } from '@/api'
import { ChangedMark } from '@/components/pokemon/changed-mark'
import { dexNumber, displayName } from '@/components/pokemon/format'
import { PokeBall } from '@/components/pokemon/poke-ball'
import { TYPE_STYLES } from '@/components/pokemon/pokemon-types'
import { TypeBadges } from '@/components/pokemon/type-badges'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { MAX_TEAM_SIZE } from '../utils/can-add'
import { MemberBall, MemberSprite } from './member-sprite'

// Slots enter one after another, in battle order, this far apart.
const ENTER_STAGGER_MS = 70
// A sprite pops out of its Poké Ball this long after its slot starts to enter.
const POP_OUT_AFTER_MS = 150
const ENTER = 'animate-in fade-in-0 slide-in-from-bottom-3 duration-300 fill-mode-both motion-reduce:animate-none'
const ROW = 'flex min-h-18 items-center gap-3 rounded-2xl py-2 pr-3 pl-4'

/** A team's six slots, stacked in battle order: its members' slots, then EmptySlots. */
export function TeamSlots({ children }: { children: ReactNode }) {
  return (
    <ol aria-label={m.team_slots()} className="flex flex-col gap-2">
      {children}
    </ol>
  )
}

type TeamSlotProps = {
  member: TeamMember
  // At the end of the row, such as a button to remove the member.
  children?: ReactNode
}

/** A member's slot as a row: its number, sprite, name, Pokédex number and types. */
export function TeamSlot({ member, children }: TeamSlotProps) {
  return (
    <MemberPanel member={member} className={ROW}>
      <SlotNumber slot={member.position} />
      <PanelSprite member={member} className="size-16" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <MemberName member={member} className="text-lg" />
        <MemberTypes member={member} />
      </div>
      <MemberNumber member={member} className="self-start pt-1" />
      {children && <div className="flex shrink-0 items-center">{children}</div>}
    </MemberPanel>
  )
}

/** A small button at the end of a member's slot, drawn in the slot's text color. */
export function SlotButton(props: ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className="grid size-8 place-items-center rounded-lg transition-colors hover:bg-current/15 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current [&_svg]:size-4"
      {...props}
    />
  )
}

/** The slots after the team's `filled` members, each a dashed "Empty slot". */
export function EmptySlots({ filled }: { filled: number }) {
  return Array.from({ length: MAX_TEAM_SIZE - filled }, (_, index) => {
    const slot = filled + index
    return (
      <li
        key={slot}
        style={{ animationDelay: `${slot * ENTER_STAGGER_MS}ms` }}
        className={cn(ROW, ENTER, 'border-2 border-dashed text-sm text-muted-foreground')}
      >
        <SlotNumber slot={slot} />
        <span className="grid size-16 shrink-0 place-items-center">
          <PokeBall className="size-9 opacity-50" />
        </span>
        {m.team_empty_slot()}
      </li>
    )
  })
}

type MemberPanelProps = { member: TeamMember; className: string; children: ReactNode }

// A member's slot, painted in its main type, or neutral once it's no longer in the Pokédex.
function MemberPanel({ member, className, children }: MemberPanelProps) {
  const colors = member.removed_at ? undefined : TYPE_STYLES[member.pokemon.types[0]]
  return (
    <li
      style={{
        backgroundColor: colors?.background,
        color: colors?.foreground,
        animationDelay: `${member.position * ENTER_STAGGER_MS}ms`,
      }}
      className={cn(
        'group/hop relative isolate overflow-hidden',
        ENTER,
        member.removed_at && 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {children}
    </li>
  )
}

function SlotNumber({ slot }: { slot: number }) {
  return <span className="w-4 shrink-0 text-sm font-bold tabular-nums opacity-80">{slot + 1}</span>
}

type PartOfMemberProps = { member: TeamMember; className?: string }

// The member's sprite in front of its ghosted Poké Ball, popping out of it as the slot enters.
function PanelSprite({ member, className }: PartOfMemberProps) {
  return (
    <div className={cn('relative isolate grid shrink-0 place-items-center', className)}>
      <MemberBall member={member} className="absolute -inset-[8%] -z-10" />
      <div
        style={{
          animationDelay: `${member.position * ENTER_STAGGER_MS + POP_OUT_AFTER_MS}ms`,
        }}
        className="size-full animate-in duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] fill-mode-both zoom-in-0 motion-reduce:animate-none"
      >
        <MemberSprite member={member} className="scale-150" />
      </div>
    </div>
  )
}

function MemberName({ member, className }: PartOfMemberProps) {
  return (
    <h2 className={cn('max-w-full truncate font-bold', className)}>
      {displayName(member.pokemon.name)}
    </h2>
  )
}

function MemberNumber({ member, className }: PartOfMemberProps) {
  return (
    <p className={cn('flex shrink-0 items-center gap-1 text-xs font-bold tabular-nums', className)}>
      <span className="opacity-80">{dexNumber(member.pokemon.id)}</span>
      {member.pokemon.changed_recently && <ChangedMark className="text-current" />}
    </p>
  )
}

// Its types, ringed so a badge in the panel's own color still shows; or that it's gone.
function MemberTypes({ member }: PartOfMemberProps) {
  if (member.removed_at) return <p className="text-xs">{m.team_removed_from_pokedex()}</p>
  return (
    <TypeBadges
      types={member.pokemon.types}
      className="*:*:data-[slot=badge]:ring-2 *:*:data-[slot=badge]:ring-white/80"
    />
  )
}
