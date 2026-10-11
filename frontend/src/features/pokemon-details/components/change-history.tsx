import type { PokemonChange } from '@/api'
import { ChangeDot, ChangeEntry } from '@/components/pokemon/change-entry'
import { m } from '@/paraglide/messages.js'

/** The changes syncs have found to a Pokémon, newest first. */
export function ChangeHistory({ changes }: { changes: PokemonChange[] }) {
  if (changes.length === 0) {
    return <p className="text-sm text-muted-foreground">{m.changes_none()}</p>
  }
  return (
    <ol aria-label={m.details_changes()} className="ml-1.5 flex flex-col gap-4 border-l-2 pl-5">
      {changes.map((change) => (
        <li key={`${change.detected_at}-${change.kind}`} className="relative">
          {/* On the line, ringed in the dialog's color so the line stops short of it. */}
          <ChangeDot
            kind={change.kind}
            className="absolute top-1.5 -left-6.75 ring-4 ring-popover"
          />
          <ChangeEntry change={change} />
        </li>
      ))}
    </ol>
  )
}
