import { Link } from 'react-router'

import type { TeamMember } from '@/api'
import { ChangedMark } from '@/components/pokemon/changed-mark'
import { m } from '@/paraglide/messages.js'

import { MAX_TEAM_SIZE } from '../utils/can-add'

type TeamCardProps = {
  to: string
  name: string
  members: TeamMember[]
  // Shown under the name, such as "Not saved".
  note?: string
}

export function TeamCard({ to, name, members, note }: TeamCardProps) {
  const changed = members.some((member) => member.pokemon.changed_recently)
  return (
    <Link
      to={to}
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-1 font-heading text-lg font-bold">
          <span className="truncate">{name}</span>
          {changed && <ChangedMark />}
        </h2>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {m.team_member_count({ count: members.length, max: MAX_TEAM_SIZE })}
        </span>
      </div>
      {note && <p className="-mt-2 text-sm text-muted-foreground">{note}</p>}
      <ol className="grid grid-cols-6 gap-1.5" aria-hidden="true">
        {Array.from({ length: MAX_TEAM_SIZE }, (_, slot) => {
          const pokemon = members[slot]?.pokemon
          return (
            <li key={slot} className="grid aspect-square place-items-center rounded-full bg-muted">
              {pokemon?.sprite_url && (
                <img
                  src={pokemon.sprite_url}
                  alt=""
                  width={48}
                  height={48}
                  loading="lazy"
                  className="size-full scale-110 object-contain [image-rendering:pixelated]"
                />
              )}
            </li>
          )
        })}
      </ol>
    </Link>
  )
}
