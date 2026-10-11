import type { TeamMember } from '@/api'
import { ChangedIcon } from '@/components/pokemon/changed-mark'
import { displayName } from '@/components/pokemon/format'
import { formatList } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

type ChangedThisWeekProps = {
  members: TeamMember[]
  // Small and muted, as on a team's card, rather than in a box above its slots.
  compact?: boolean
  className?: string
}

/**
 * A line naming the members a sync changed in the last week, removed ones included, or nothing
 * when it changed none. It goes once none of them changed recently.
 */
export function ChangedThisWeek({ members, compact = false, className }: ChangedThisWeekProps) {
  const names = members
    .filter((member) => member.pokemon.changed_recently)
    .map((member) => displayName(member.pokemon.name))
  if (names.length === 0) return null
  return (
    <p
      className={cn(
        'flex items-start',
        compact
          ? 'gap-1.5 text-xs text-muted-foreground'
          : 'gap-2 rounded-xl border bg-card px-3.5 py-2.5 text-sm',
        className,
      )}
    >
      {/* A line tall, so it's beside the first line of the words. */}
      <ChangedIcon className={cn('h-lh', !compact && 'text-muted-foreground')} />
      {changedLine(names)}
    </p>
  )
}

// The first two names, and how many more if there are more than two.
function changedLine(names: string[]) {
  if (names.length === 1) return m.team_changed_one({ name: names[0] })
  if (names.length === 2) return m.team_changed_two({ first: names[0], second: names[1] })
  return m.team_changed_more({ names: formatList(names.slice(0, 2)), count: names.length - 2 })
}
