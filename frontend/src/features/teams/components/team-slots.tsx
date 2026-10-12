import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Replace } from 'lucide-react'
import { type ComponentProps, type ReactNode, type Ref, useId } from 'react'
import { Link } from 'react-router'

import { ChangeKind, type Stats, type TeamMember } from '@/api'
import { BaseStats } from '@/components/pokemon/base-stats'
import { ChangeDot } from '@/components/pokemon/change-entry'
import { ChangedMark } from '@/components/pokemon/changed-mark'
import { dexNumber, displayName, MAX_STAT_TOTAL, statTotal } from '@/components/pokemon/format'
import { PokeBall } from '@/components/pokemon/poke-ball'
import { TypeBadges } from '@/components/pokemon/type-badges'
import { Progress } from '@/components/ui/progress'
import { useFirstRender } from '@/hooks/use-first-render'
import { formatDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { ENTER, Entering, useEnterDelay } from '../hooks/use-enter-delay'
import { MAX_TEAM_SIZE } from '../utils/can-add'
import { memberColors, MUTED } from '../utils/member-colors'
import { MemberBall } from './member-ball'
import { MemberSprite } from './member-sprite'
import { NewestChange, NewestChangeLine } from './newest-change'

// A sprite pops out of its Poké Ball this long after its slot starts to enter.
const POP_OUT_AFTER_MS = 150
const ROW = 'flex min-h-18 items-center gap-3 py-2 pr-3 pl-4 @max-[34rem]/slots:min-h-16'

type TeamSlotsProps = {
  // The list, which focus can be moved to.
  ref?: Ref<HTMLOListElement>
  children: ReactNode
}

/**
 * A team's six slots, stacked in battle order: its members' slots, then EmptySlots. Narrower than
 * 34rem, as in Edit's column, the slots are compact.
 */
export function TeamSlots({ ref, children }: TeamSlotsProps) {
  const entering = useFirstRender()
  return (
    <Entering value={entering}>
      <ol
        ref={ref}
        tabIndex={-1}
        aria-label={m.team_slots()}
        className="@container/slots flex flex-col gap-2 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {children}
      </ol>
    </Entering>
  )
}

/**
 * A team's six slots as a party: a LeadSlot, then the other members' slots and EmptySlots. From
 * md up, the first slot runs down the left beside the other five. The columns keep their widths
 * however long a slot's line, which is cut short instead.
 */
export function PartySlots({ children }: { children: ReactNode }) {
  const entering = useFirstRender()
  return (
    <Entering value={entering}>
      <ol
        aria-label={m.team_slots()}
        className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:grid-rows-5 md:gap-3 md:*:first:row-span-5"
      >
        {children}
      </ol>
    </Entering>
  )
}

type LeadSlotProps = {
  member: TeamMember
  // Opens the member's details.
  onOpen: () => void
  // Beside the "Lead" label, such as a ReplaceLink.
  children?: ReactNode
}

/**
 * The lead's slot, large: labelled as the lead, with a big sprite, its name, types and stats, and
 * its newest change if a sync changed it recently.
 */
export function LeadSlot({ member, onOpen, children }: LeadSlotProps) {
  const headingId = useId()
  return (
    <MemberPanel member={member} className="flex flex-col gap-3 rounded-3xl p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
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
      <NewestChange member={member} />
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
 * A member's slot as a row: its number, sprite, Pokédex number, name, types and base stat total,
 * and its newest change on a line if a sync changed it recently; in a row at least 34rem wide, its
 * base stats too. In TeamSlots narrower than 34rem, its sprite is smaller, and its Pokédex number
 * and base stat total are left out, with the changed mark beside its name instead.
 */
export function TeamSlot({ member, onOpen, children }: TeamSlotProps) {
  return (
    <MemberPanel member={member} className={cn(ROW, '@container rounded-2xl')}>
      <SlotRow member={member} onOpen={onOpen}>
        {children}
      </SlotRow>
    </MemberPanel>
  )
}

/**
 * A TeamSlot, inside SortableMembers, that can be dragged to another member's slot: by any part
 * of it, or with the keyboard from the handle at its start.
 */
export function SortableTeamSlot({ member, onOpen, children }: TeamSlotProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: member.pokemon.id, attributes: { roleDescription: m.team_move_handle() } })
  return (
    <MemberPanel
      ref={setNodeRef}
      member={member}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(ROW, '@container gap-2 rounded-2xl pl-1', isDragging && 'z-10 shadow-xl')}
      {...listeners}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        aria-label={m.team_move({ name: displayName(member.pokemon.name) })}
        // Over the open button, so it can be pressed on its own. A finger on it drags the slot
        // rather than scrolling the page. On touch screens it takes touches 44px wide, from the
        // slot's edge.
        className="relative z-10 grid h-12 w-6 shrink-0 cursor-grab touch-none place-items-center rounded-lg transition-colors hover:bg-current/15 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current active:cursor-grabbing pointer-coarse:after:absolute pointer-coarse:after:inset-y-0 pointer-coarse:after:-right-4 pointer-coarse:after:-left-1 [&_svg]:size-4"
      >
        <GripVertical aria-hidden="true" />
      </button>
      <SlotRow member={member} onOpen={onOpen}>
        {children}
      </SlotRow>
    </MemberPanel>
  )
}

// What a TeamSlot's row holds, after anything at its start.
function SlotRow({ member, onOpen, children }: TeamSlotProps) {
  const headingId = useId()
  return (
    <>
      <SlotNumber slot={member.position} />
      <PanelSprite member={member} className="size-16 @max-[34rem]/slots:size-12" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <MemberNumber member={member} className="@max-[34rem]/slots:hidden" />
        <div className="flex max-w-full items-center gap-1">
          <MemberName
            id={headingId}
            member={member}
            className="min-w-0 truncate text-lg font-extrabold @max-[34rem]/slots:text-base @max-[34rem]/slots:leading-5"
          />
          {/* In place of the Pokédex number's mark, while the number is left out. */}
          {member.pokemon.changed_recently && (
            <ChangedMark className="hidden shrink-0 text-current @max-[34rem]/slots:inline-flex" />
          )}
        </div>
        <MemberTypes member={member} />
        <TotalBar stats={member.pokemon.stats} className="@max-[34rem]/slots:hidden" />
        <NewestChangeLine member={member} className="mt-0.5" />
      </div>
      <PanelStats
        stats={member.pokemon.stats}
        className="hidden w-44 shrink-0 gap-0 text-[11px] leading-tight @min-[34rem]:flex"
      />
      {onOpen && <OpenButton labelledBy={headingId} onOpen={onOpen} />}
      {/* Over the open button, so it can be pressed on its own. */}
      {children && <div className="relative z-10 flex shrink-0 items-center gap-1">{children}</div>}
    </>
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
  const label = m.team_replace_named({ name: displayName(member.pokemon.name) })
  return (
    <Link
      to={to}
      aria-label={label}
      // Below sm, or in TeamSlots narrower than 34rem, it's just its icon, so hovering it says what
      // it does.
      title={label}
      className="inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-lg border border-current text-sm font-semibold transition-colors hover:bg-current/8 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current sm:px-2.5 @max-[34rem]/slots:px-0"
    >
      <Replace className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline @max-[34rem]/slots:hidden">{m.team_replace()}</span>
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

type MemberPanelProps = { member: TeamMember } & ComponentProps<'li'>

// A member's slot, painted in its main type, or neutral once it's no longer in the Pokédex.
function MemberPanel({ member, style, className, children, ...props }: MemberPanelProps) {
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

// As large as a member's sprite in a row as wide.
function EmptyBall() {
  return (
    <span className="grid size-16 shrink-0 place-items-center @max-[34rem]/slots:size-12">
      <PokeBall className="size-9 opacity-50 @max-[34rem]/slots:size-7" />
    </span>
  )
}

function SlotNumber({ slot }: { slot: number }) {
  return <span className="w-4 shrink-0 text-sm font-medium tabular-nums">{slot + 1}</span>
}

type PartOfMemberProps = { member: TeamMember; className?: string }

// The member's sprite in front of its ghosted Poké Ball, popping out of it as the slot enters.
function PanelSprite({ member, className }: PartOfMemberProps) {
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

function MemberName({ member, id, className }: PartOfMemberProps & { id: string }) {
  return (
    <h2 id={id} className={cn('max-w-full font-bold', className)}>
      {displayName(member.pokemon.name)}
    </h2>
  )
}

function MemberNumber({ member, className }: PartOfMemberProps) {
  return (
    <p className={cn('flex items-center gap-1 text-xs font-medium tabular-nums', className)}>
      {dexNumber(member.pokemon.id)}
      {member.pokemon.changed_recently && <ChangedMark className="text-current" />}
    </p>
  )
}

// Its types, ringed so a badge in the panel's own color still shows; or, for a member removed from
// the Pokédex, the date it was removed. A removal from this week is the member's change, so it gets
// the dot the Pokédex's change history marks a removal with.
function MemberTypes({ member }: PartOfMemberProps) {
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

// The base stat total, with a bar against MAX_STAT_TOTAL that a total past it fills.
function TotalBar({ stats, className }: StatsProps) {
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
