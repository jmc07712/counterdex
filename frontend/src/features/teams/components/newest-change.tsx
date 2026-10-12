import type { TeamMember } from '@/api'
import { ChangeDot, ChangeEntry, ChangeSummary } from '@/components/pokemon/change-entry'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { useNewestChange } from '../hooks/use-newest-change'

// On a member's panel, a shade of its text color.
const SKELETON = 'bg-current/20'

/**
 * A changed member's newest change in full, as the Pokédex's change history shows it, in the
 * panel's text color.
 */
export function NewestChange({ member }: { member: TeamMember }) {
  const { loading, newest } = useNewestChange(member)
  if (loading) return <Skeleton className={cn('h-6 w-2/3', SKELETON)} />
  if (!newest) return null
  return (
    <div className="flex gap-2.5">
      <ChangeDot kind={newest.kind} className="mt-1.5" />
      <ChangeEntry change={newest} className="min-w-0 [&_dt]:text-current [&_time]:text-current" />
    </div>
  )
}

type NewestChangeLineProps = { member: TeamMember; className?: string }

/** A changed member's newest change on one line, in the panel's text color. */
export function NewestChangeLine({ member, className }: NewestChangeLineProps) {
  const { loading, newest } = useNewestChange(member)
  if (loading) return <Skeleton className={cn('h-4 w-32', SKELETON, className)} />
  if (!newest) return null
  return (
    <div className={cn('flex max-w-full items-center gap-1.5 text-xs', className)}>
      <ChangeDot kind={newest.kind} className="size-2.5" />
      <ChangeSummary change={newest} className="min-w-0" />
    </div>
  )
}
