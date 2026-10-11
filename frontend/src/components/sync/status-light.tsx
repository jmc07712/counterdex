import { cn } from '@/lib/utils'

/**
 * A sync's status as a light: yellow if it failed, green otherwise. It's decoration: say the
 * status in words beside it.
 */
export function StatusLight({ failed }: { failed: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative block size-2 shrink-0 rounded-full',
        failed ? 'bg-led-yellow' : 'bg-led-green',
      )}
    />
  )
}

/** A green status light that pings, for a sync status that's live. */
export function LiveStatusLight() {
  return (
    <span aria-hidden="true" className="relative flex size-2 shrink-0">
      <span className="absolute inset-0 rounded-full bg-led-green opacity-60 motion-safe:animate-ping" />
      <StatusLight failed={false} />
    </span>
  )
}
