import { ChangeKind, type Pokemon, type PokemonChange } from '@/api'
import { formatDate } from '@/lib/dates'
import { formatList } from '@/lib/lists'
import type { Message } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { displayName, formLabel, STATS } from './format'

const DOTS: Record<ChangeKind, string> = {
  updated: 'bg-led-yellow',
  removed: 'bg-destructive',
  restored: 'bg-led-green',
}

type Field = {
  label: Message
  value: (pokemon: Pokemon) => string
  // How a change to it reads, if not "before → after".
  change?: Message
}

// What a sync can change about a Pokémon, in the order shown.
const FIELDS: Field[] = [
  { label: m.changes_field_name, value: (pokemon) => displayName(pokemon.name) },
  {
    label: m.pokemon_types,
    value: (pokemon) => formatList(pokemon.types.map((type) => m.pokemon_type({ type }))),
  },
  ...STATS.map((stat) => ({
    label: () => m.pokemon_stat({ stat }),
    value: (pokemon: Pokemon) => String(pokemon.stats[stat]),
  })),
  {
    label: m.changes_field_form,
    value: (pokemon) => formLabel(pokemon) ?? m.changes_form_standard(),
  },
  {
    label: m.changes_field_sprite,
    value: (pokemon) => pokemon.sprite_url ?? '',
    change: m.changes_new_image,
  },
]

type ChangeDotProps = { kind: ChangeKind; className?: string }

/**
 * A dot in the color of a change's kind, ringed in the text color so it shows on any background.
 * It's decoration: the change's words say its kind.
 */
export function ChangeDot({ kind, className }: ChangeDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('size-3 shrink-0 rounded-full ring-1 ring-current', DOTS[kind], className)}
    />
  )
}

type ChangeEntryProps = { change: PokemonChange; className?: string }

/** A change a sync found to a Pokémon: its kind and date, then each field it changed. */
export function ChangeEntry({ change, className }: ChangeEntryProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold">{m.changes_kind({ kind: change.kind })}</span>
        <time dateTime={change.detected_at} className="text-xs text-muted-foreground">
          {formatDate(change.detected_at)}
        </time>
      </div>
      {change.before && change.after && (
        <Differences before={change.before} after={change.after} />
      )}
    </div>
  )
}

type ChangeSummaryProps = { change: PokemonChange; className?: string }

// A part of a one-line change: inline, after a dot unless it's the first.
const SUMMARY_ITEM =
  'inline not-first:before:mx-1.5 not-first:before:inline-block not-first:before:size-1 not-first:before:rounded-full not-first:before:bg-current not-first:before:align-middle'

/**
 * A change on one line, cut short if it doesn't fit: each field an update changed, or a removal's
 * or restoration's kind and date. Each is an item of an inline list, with a dot between them.
 */
export function ChangeSummary({ change, className }: ChangeSummaryProps) {
  const differences =
    change.kind === ChangeKind.UPDATED && change.before && change.after
      ? differencesBetween(change.before, change.after)
      : []
  return (
    // Safari drops a list's role when it's styled without markers, so it's given again.
    <ul role="list" className={cn('truncate', className)}>
      {differences.length > 0 ? (
        differences.map(({ field, difference }) => (
          <li key={field} className={SUMMARY_ITEM}>
            {field} <span className="font-semibold tabular-nums">{difference}</span>
          </li>
        ))
      ) : (
        <>
          <li className={cn(SUMMARY_ITEM, 'font-semibold')}>
            {m.changes_kind({ kind: change.kind })}
          </li>
          <li className={SUMMARY_ITEM}>
            <time dateTime={change.detected_at}>{formatDate(change.detected_at)}</time>
          </li>
        </>
      )}
    </ul>
  )
}

function Differences({ before, after }: { before: Pokemon; after: Pokemon }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
      {differencesBetween(before, after).map(({ field, difference }) => (
        <div key={field} className="contents">
          <dt className="text-muted-foreground">{field}</dt>
          <dd className="tabular-nums">{difference}</dd>
        </div>
      ))}
    </dl>
  )
}

// Each field that differs from `before` to `after`, in FIELDS' order, and how its change reads.
function differencesBetween(before: Pokemon, after: Pokemon) {
  return FIELDS.filter((field) => field.value(before) !== field.value(after)).map(
    ({ label, value, change }) => ({
      field: label(),
      difference:
        change?.() ?? m.changes_before_after({ before: value(before), after: value(after) }),
    }),
  )
}
