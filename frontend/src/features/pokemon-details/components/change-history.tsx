import type { ChangeKind, Pokemon, PokemonChange } from '@/api'
import { displayName, formLabel, STATS } from '@/components/pokemon/format'
import { formatDate, formatList } from '@/lib/dates'
import type { Message } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

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

/** The changes syncs have found to a Pokémon, newest first. */
export function ChangeHistory({ changes }: { changes: PokemonChange[] }) {
  if (changes.length === 0) {
    return <p className="text-sm text-muted-foreground">{m.changes_none()}</p>
  }
  return (
    <ol aria-label={m.details_changes()} className="ml-1.5 flex flex-col gap-4 border-l-2 pl-5">
      {changes.map((change) => (
        <li key={`${change.detected_at}-${change.kind}`} className="relative flex flex-col gap-1.5">
          <span
            aria-hidden="true"
            className={cn(
              'absolute top-1.5 -left-6.75 size-3 rounded-full ring-4 ring-popover',
              DOTS[change.kind],
            )}
          />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{m.changes_kind({ kind: change.kind })}</span>
            <time dateTime={change.detected_at} className="text-xs text-muted-foreground">
              {formatDate(change.detected_at)}
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
