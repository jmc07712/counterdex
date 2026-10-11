import type { TeamMember } from '@/api'
import { ChangedIcon } from '@/components/pokemon/changed-mark'
import { Alert, AlertTitle } from '@/components/ui/alert'

import { changedThisWeek } from '../utils/changed-this-week'

type ChangedThisWeekProps = { members: TeamMember[]; className?: string }

/**
 * Above a team's slots, a box naming the members a sync changed in the last week, or nothing when
 * it changed none. Its role is status rather than alert, as it isn't urgent.
 */
export function ChangedThisWeekAlert({ members, className }: ChangedThisWeekProps) {
  const sentence = changedThisWeek(members)
  if (!sentence) return null
  return (
    <Alert role="status" className={className}>
      <ChangedIcon />
      <AlertTitle>{sentence}</AlertTitle>
    </Alert>
  )
}

/** On a team's card, a small muted line naming the members a sync changed in the last week. */
export function ChangedThisWeekNote({ members }: { members: TeamMember[] }) {
  const sentence = changedThisWeek(members)
  if (!sentence) return null
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      {/* A line tall, so it's beside the first line of the words. */}
      <ChangedIcon className="h-lh" />
      {sentence}
    </p>
  )
}
