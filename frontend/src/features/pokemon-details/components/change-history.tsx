import { format } from 'date-fns'

import type { ChangeKind, Pokemon, PokemonChange } from '@/api'
import { displayName, formLabel, STAT_LABELS, STATS } from '@/components/pokemon/format'
import { cn } from '@/lib/utils'

// How each kind of change shows. A Record, so a kind the API adds needs one.
const KINDS: Record<ChangeKind, { label: string; dot: string }> = {
  updated: { label: 'Updated', dot: 'bg-primary' },
  removed: { label: 'Removed from PokéAPI', dot: 'bg-destructive' },
  restored: { label: 'Back in PokéAPI', dot: 'bg-led-green' },
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
    // A timeline: a line down the left, with a dot in each change's color.
    <ol aria-label="Changes" className="ml-1.5 flex flex-col gap-4 border-l-2 pl-5">
      {changes.map((change) => (
        <li key={`${change.detected_at}-${change.kind}`} className="relative flex flex-col gap-1.5">
          <span
            aria-hidden="true"
            className={cn(
              'absolute top-1.5 -left-[27px] size-3 rounded-full ring-4 ring-popover',
              KINDS[change.kind].dot,
            )}
          />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{KINDS[change.kind].label}</span>
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
