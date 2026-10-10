import { format } from 'date-fns'

import type { ChangeKind, Pokemon, PokemonChange } from '@/api'
import { displayName, formLabel, STAT_LABELS, STATS } from '@/components/pokemon/format'
import { Badge } from '@/components/ui/badge'

// What each kind of change means. A Record, so a kind the API adds needs a label.
const KIND_LABELS: Record<ChangeKind, string> = {
  updated: 'Updated',
  removed: 'Removed from PokéAPI',
  restored: 'Back in PokéAPI',
}

type Field = {
  label: string
  value: (pokemon: Pokemon) => string | null
  // How a change to it reads, if not "before → after".
  change?: string
}

// What a sync can change about a Pokémon, in the order shown.
const FIELDS: Field[] = [
  { label: 'Name', value: (pokemon) => displayName(pokemon.name) },
  { label: 'Types', value: (pokemon) => pokemon.types.map(displayName).join(', ') },
  ...STATS.map((stat) => ({
    label: STAT_LABELS[stat],
    value: (pokemon: Pokemon) => String(pokemon.stats[stat]),
  })),
  { label: 'Form', value: (pokemon) => formLabel(pokemon) ?? 'Standard' },
  { label: 'Sprite', value: (pokemon) => pokemon.sprite_url, change: 'New image' },
]

/** The changes syncs have found to a Pokémon, newest first. */
export function ChangeHistory({ changes }: { changes: PokemonChange[] }) {
  if (changes.length === 0) {
    return <p className="text-sm text-muted-foreground">No changes since it joined the Pokédex.</p>
  }
  return (
    <ol aria-label="Changes" className="flex flex-col gap-3">
      {changes.map((change) => (
        <li key={`${change.detected_at}-${change.kind}`} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Badge variant={change.kind === 'removed' ? 'destructive' : 'secondary'}>
              {KIND_LABELS[change.kind]}
            </Badge>
            <time dateTime={change.detected_at} className="text-xs text-muted-foreground">
              {format(new Date(change.detected_at), 'PP')}
            </time>
          </div>
          {change.before && change.after && (
            <Differences before={change.before} after={change.after} />
          )}
        </li>
      ))}
    </ol>
  )
}

function Differences({ before, after }: { before: Pokemon; after: Pokemon }) {
  const changed = FIELDS.filter((field) => field.value(before) !== field.value(after))
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
      {changed.map(({ label, value, change }) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="tabular-nums">{change ?? `${value(before)} → ${value(after)}`}</dd>
        </div>
      ))}
    </dl>
  )
}
