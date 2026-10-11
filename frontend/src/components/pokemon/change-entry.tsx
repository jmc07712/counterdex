import type { ChangeKind, Pokemon, PokemonChange } from '@/api'
import { formatDate, formatList } from '@/lib/dates'
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

/** A dot in the color of a change's kind, for decoration: the change's words say its kind. */
export function ChangeDot({ kind, className }: ChangeDotProps) {
  return (
    <span aria-hidden="true" className={cn('size-3 shrink-0 rounded-full', DOTS[kind], className)} />
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

function Differences({ before, after }: { before: Pokemon; after: Pokemon }) {
  const changed = FIELDS.filter((field) => field.value(before) !== field.value(after))
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
      {changed.map(({ label, value, change }) => (
        <div key={label()} className="contents">
          <dt className="text-muted-foreground">{label()}</dt>
          <dd className="tabular-nums">
            {change?.() ?? m.changes_before_after({ before: value(before), after: value(after) })}
          </dd>
        </div>
      ))}
    </dl>
  )
}
