import { Plus, Replace } from 'lucide-react'
import { type ComponentProps, type ReactNode, useId } from 'react'
import { Link } from 'react-router'

import type { Stats, TeamMember } from '@/api'
import { BaseStats } from '@/components/pokemon/base-stats'
import { ChangedMark } from '@/components/pokemon/changed-mark'
import { dexNumber, displayName, MAX_STAT_TOTAL, statTotal } from '@/components/pokemon/format'
import { PokeBall } from '@/components/pokemon/poke-ball'
import { TypeBadges } from '@/components/pokemon/type-badges'
import { Progress } from '@/components/ui/progress'
import { formatDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { MAX_TEAM_SIZE } from '../utils/can-add'
import { memberColors } from '../utils/member-colors'
import { MemberBall } from './member-ball'
import { MemberSprite } from './member-sprite'

// Slots enter one after another, in battle order, this far apart.
const ENTER_STAGGER_MS = 70
// A sprite pops out of its Poké Ball this long after its slot starts to enter.
const POP_OUT_AFTER_MS = 150
const ENTER = 'animate-in fade-in-0 slide-in-from-bottom-3 duration-300 fill-mode-both motion-reduce:animate-none'
const ROW = 'flex min-h-18 items-center gap-3 py-2 pr-3 pl-4'

/** A team's six slots, stacked in battle order: its members' slots, then EmptySlots. */
export function TeamSlots({ children }: { children: ReactNode }) {
  return (
    <ol aria-label={m.team_slots()} className="flex flex-col gap-2">
      {children}
    </ol>
  )
}

/**
 * A team's six slots as a party: a LeadSlot, then the other members' slots and EmptySlots. From
 * md up, the first slot runs down the left beside the other five.
 */
export function PartySlots({ children }: { children: ReactNode }) {
  return (
    <ol
      aria-label={m.team_slots()}
      className="grid gap-2 md:grid-cols-[5fr_7fr] md:grid-rows-5 md:gap-3 md:*:first:row-span-5"
    >
      {children}
    </ol>
  )
}

type LeadSlotProps = {
  member: TeamMember
  // Opens the member's details.
  onOpen: () => void
  // Beside the "Lead" label, such as a ReplaceLink.
  children?: ReactNode
}

/** The lead's slot, large: labelled as the lead, with a big sprite, its name, types and stats. */
export function LeadSlot({ member, onOpen, children }: LeadSlotProps) {
  const headingId = useId()
  return (
    <MemberPanel member={member} className="flex flex-col gap-3 rounded-3xl p-5 md:p-6">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <p className="rounded-full border border-current px-2.5 py-0.5 text-xs font-bold">
          {m.team_lead()}
        </p>
        {/* Over the open button, so it can be pressed on its own. */}
        {children && <div className="relative z-10">{children}</div>}
      </div>
      {/* On phones the sprite sits beside the words; from md up, above them. */}
      <div className="flex flex-1 items-center gap-4 md:flex-col-reverse md:items-stretch">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1 md:flex-none">
          <MemberNumber member={member} />
          <MemberName
            id={headingId}
            member={member}
            className="text-2xl font-extrabold break-words sm:text-3xl md:text-4xl"
          />
          <MemberTypes member={member} />
        </div>
        <PanelSprite
          member={member}
          className="size-28 md:my-auto md:size-44 md:self-center lg:size-56"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <PanelStats stats={member.pokemon.stats} />
        <dl className="flex justify-end gap-1 text-xs">
          <dt>{m.pokemon_stat_total()}</dt>
          <dd className="font-bold tabular-nums">{statTotal(member.pokemon.stats)}</dd>
        </dl>
      </div>
      <OpenButton labelledBy={headingId} onOpen={onOpen} />
    </MemberPanel>
  )
}

type TeamSlotProps = {
  member: TeamMember
  // Opens the member's details; without it, the slot doesn't open.
  onOpen?: () => void
  // At the end of the row, such as a button to remove the member.
  children?: ReactNode
}

/**
 * A member's slot as a row: its number, sprite, Pokédex number, name, types and base stat total;
 * from lg up, where the row is wide enough, its base stats too.
 */
export function TeamSlot({ member, onOpen, children }: TeamSlotProps) {
  const headingId = useId()
  return (
    <MemberPanel member={member} className={cn(ROW, 'rounded-2xl')}>
      <SlotNumber slot={member.position} />
      <PanelSprite member={member} className="size-16" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <MemberNumber member={member} />
        <MemberName id={headingId} member={member} className="truncate text-lg font-extrabold" />
        <MemberTypes member={member} />
        <TotalBar stats={member.pokemon.stats} />
      </div>
      <PanelStats
        stats={member.pokemon.stats}
        className="hidden w-44 shrink-0 gap-0 text-[11px] leading-tight lg:flex"
      />
      {onOpen && <OpenButton labelledBy={headingId} onOpen={onOpen} />}
      {/* Over the open button, so it can be pressed on its own. */}
      {children && <div className="relative z-10 flex shrink-0 items-center">{children}</div>}
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

/** A link to swap a member for another Pokémon, drawn in the slot's text color. */
export function ReplaceLink({ member, to }: { member: TeamMember; to: string }) {
  return (
    <Link
      to={to}
      aria-label={m.team_replace_named({ name: displayName(member.pokemon.name) })}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-current px-2.5 text-sm font-semibold transition-colors hover:bg-current/15 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current"
    >
      <Replace className="size-4" aria-hidden="true" />
      {m.team_replace()}
    </Link>
  )
}

type EmptySlotsProps = {
  filled: number
  // Where each empty slot links to be filled, such as the team's Edit page. Without it, the slots
  // don't link.
  to?: string
}

/** The slots after the team's `filled` members, each dashed: "Empty slot", or a link to fill it. */
export function EmptySlots({ filled, to }: EmptySlotsProps) {
  return Array.from({ length: MAX_TEAM_SIZE - filled }, (_, index) => {
    const slot = filled + index
    return (
      <li
        key={slot}
        style={{ animationDelay: `${slot * ENTER_STAGGER_MS}ms` }}
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
  })
}

type MemberPanelProps = { member: TeamMember; className: string; children: ReactNode }

// A member's slot, painted in its main type, or neutral once it's no longer in the Pokédex.
function MemberPanel({ member, className, children }: MemberPanelProps) {
  const colors = memberColors(member)
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
        !colors && 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {children}
    </li>
  )
}

function EmptyBall() {
  return (
    <span className="grid size-16 shrink-0 place-items-center">
      <PokeBall className="size-9 opacity-50" />
    </span>
  )
}

function SlotNumber({ slot }: { slot: number }) {
  return <span className="w-4 shrink-0 text-sm font-medium tabular-nums">{slot + 1}</span>
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

function MemberName({ member, id, className }: PartOfMemberProps & { id: string }) {
  return (
    <h2 id={id} className={cn('max-w-full font-bold', className)}>
      {displayName(member.pokemon.name)}
    </h2>
  )
}

function MemberNumber({ member }: PartOfMemberProps) {
  return (
    <p className="flex items-center gap-1 text-xs font-medium tabular-nums">
      <span>{dexNumber(member.pokemon.id)}</span>
      {member.pokemon.changed_recently && <ChangedMark className="text-current" />}
    </p>
  )
}

// Its types, ringed so a badge in the panel's own color still shows; or when it was removed.
function MemberTypes({ member }: PartOfMemberProps) {
  if (member.removed_at) {
    return <p className="text-xs">{m.team_removed_on({ date: formatDate(member.removed_at) })}</p>
  }
  return (
    <TypeBadges
      types={member.pokemon.types}
      className="*:*:data-[slot=badge]:ring-2 *:*:data-[slot=badge]:ring-white/80"
    />
  )
}

type StatsProps = { stats: Stats; className?: string }

// The base stats in the panel's text color: labels, values and bars, on a faint track.
function PanelStats({ stats, className }: StatsProps) {
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

// The base stat total, with a bar against MAX_STAT_TOTAL, like the HP bar on the games' party
// screen. A total past it fills the bar.
function TotalBar({ stats }: StatsProps) {
  const total = statTotal(stats)
  return (
    <dl className="flex items-center gap-1.5 text-xs">
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

type OpenButtonProps = { labelledBy: string; onOpen: () => void }

// Over the whole slot, so all of it opens the details. It's named by the slot's heading, so it
// reads as "Charizard, button".
function OpenButton({ labelledBy, onOpen }: OpenButtonProps) {
  return (
    <button
      type="button"
      aria-labelledby={labelledBy}
      onClick={onOpen}
      className="absolute inset-0 rounded-[inherit] outline-none focus-visible:inset-ring-3 focus-visible:inset-ring-current"
    />
  )
}
