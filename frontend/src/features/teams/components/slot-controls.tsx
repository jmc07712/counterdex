import { Replace } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Link } from 'react-router'

import type { TeamMember } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { m } from '@/paraglide/messages.js'

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

type OpenButtonProps = { labelledBy: string; onOpen: () => void }

/**
 * A button over the whole slot, so all of it opens the details. It's named by the slot's heading,
 * so it reads as "Charizard, button".
 */
export function OpenButton({ labelledBy, onOpen }: OpenButtonProps) {
  return (
    <button
      type="button"
      aria-labelledby={labelledBy}
      onClick={onOpen}
      className="absolute inset-0 rounded-[inherit] outline-none focus-visible:inset-ring-3 focus-visible:inset-ring-current"
    />
  )
}
