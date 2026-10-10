import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'

import { syncStatusOptions } from '@/api/@tanstack/react-query.gen'

/** "Synced with PokéAPI about 3 hours ago", once the Pokédex has been synced. */
export function LastSynced() {
  const { data } = useQuery(syncStatusOptions())

  if (!data?.last_synced_at) return null
  const syncedAt = new Date(data.last_synced_at)

  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <span aria-hidden="true" className="size-2 rounded-full bg-led-green" />
      <span>
        Synced with PokéAPI{' '}
        <time dateTime={data.last_synced_at} title={format(syncedAt, 'PPpp')}>
          {formatDistanceToNow(syncedAt, { addSuffix: true })}
        </time>
      </span>
    </p>
  )
}
