import { type ReactNode, useId } from 'react'

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import type { MatchupPool } from '../types'
import { MatchupPoolToggles } from './matchup-pool-toggles'

type MatchupSectionProps = {
  title: string
  description: string
  pool: MatchupPool
  onPoolChange: (pool: MatchupPool) => void
  children: ReactNode
}

/**
 * A section under a team's party on Pokémon picked against it, with toggles for what they're
 * picked from. Its contents lay out by the section's own width.
 */
export function MatchupSection({
  title,
  description,
  pool,
  onPoolChange,
  children,
}: MatchupSectionProps) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="@container mt-12 flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div>
          <h2 id={headingId} className="text-2xl font-extrabold sm:text-3xl">
            {title}
          </h2>
          <p className="mt-1 text-muted-foreground">{description}</p>
        </div>
        <MatchupPoolToggles pool={pool} onChange={onPoolChange} />
      </div>
      {children}
    </section>
  )
}

type MatchupResultsProps = {
  // While a toggle's answer loads, and the last answer is still shown.
  busy: boolean
  className?: string
  children: ReactNode
}

/**
 * A section's answer, such as its picks or that it needs a sync. Dimmed and busy while a toggle's
 * answer loads.
 */
export function MatchupResults({ busy, className, children }: MatchupResultsProps) {
  return (
    <div
      aria-busy={busy}
      className={cn('transition-opacity duration-200 aria-busy:opacity-60', className)}
    >
      {children}
    </div>
  )
}

/** As tall as the picks and their matchups, while the first of them load. */
export function MatchupSkeleton({ label }: { label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-3">
      <Skeleton className="h-12 rounded-xl" />
      <div className="grid grid-cols-1 gap-2 @xl:grid-cols-2 @4xl:grid-cols-3">
        {[0, 1, 2].map((each) => (
          <Skeleton key={each} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}

/** Says Pokémon can't be picked until a sync has stored enough of them. */
export function MatchupNeedsSync({ children }: { children: string }) {
  return (
    <Alert>
      <AlertTitle>{children}</AlertTitle>
    </Alert>
  )
}

type MatchupLoadFailedProps = { title: string; onRetry: () => void }

export function MatchupLoadFailed({ title, onRetry }: MatchupLoadFailedProps) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{m.common_check_connection()}</AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {m.common_try_again()}
        </Button>
      </AlertAction>
    </Alert>
  )
}
