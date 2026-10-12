import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { type ReactNode, type Ref, useId } from 'react'

import type { TeamMember } from '@/api'
import { ChangedMark } from '@/components/pokemon/changed-mark'
import { displayName, statTotal } from '@/components/pokemon/format'
import { useFirstRender } from '@/hooks/use-first-render'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { Entering } from '../hooks/use-enter-delay'
import {
  MemberName,
  MemberNumber,
  MemberPanel,
  MemberTypes,
  PanelSprite,
  PanelStats,
  TotalBar,
} from './member-panel'
import { NewestChange, NewestChangeLine } from './newest-change'
import { OpenButton } from './slot-controls'

/** A slot laid out as a row, as a member's TeamSlot and an empty slot are. */
export const ROW = 'flex min-h-18 items-center gap-3 py-2 pr-3 pl-4 @max-[34rem]/slots:min-h-16'

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

/** A slot's number in battle order, counting from 1. */
export function SlotNumber({ slot }: { slot: number }) {
  return <span className="w-4 shrink-0 text-sm font-medium tabular-nums">{slot + 1}</span>
}
