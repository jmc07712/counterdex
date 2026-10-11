import { Link } from 'react-router'

import type { TeamMember } from '@/api'
import { ChangedMark } from '@/components/pokemon/changed-mark'
import { PokeBall } from '@/components/pokemon/poke-ball'
import { TYPE_STYLES } from '@/components/pokemon/pokemon-types'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { MAX_TEAM_SIZE } from '../utils/can-add'
import { MemberBall, MemberSprite } from './member-sprite'

// On hover or focus, the sprites hop one after another, this far apart.
const HOP_STAGGER_MS = 60

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
      className="group/hop flex flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
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
      {/* Room above the tiles for the sprites standing on them. */}
      <ol className="grid grid-cols-6 gap-1.5 pt-4" aria-hidden="true">
        {members.map((member) => (
          <MemberTile key={member.pokemon.id} member={member} />
        ))}
        {Array.from({ length: MAX_TEAM_SIZE - members.length }, (_, index) => (
          <li
            key={members.length + index}
            className="grid aspect-square place-items-center rounded-lg border-2 border-dashed text-muted-foreground"
          >
            <PokeBall className="size-1/2 opacity-50" />
          </li>
        ))}
      </ol>
    </Link>
  )
}

// A member's tile, in its main type's color, or neutral once it's no longer in the Pokédex. Its
// sprite stands on the tile and rises over its top edge.
function MemberTile({ member }: { member: TeamMember }) {
  const colors = member.removed_at ? undefined : TYPE_STYLES[member.pokemon.types[0]]
  return (
    <li
      style={{ backgroundColor: colors?.background }}
      className={cn(
        'relative aspect-square rounded-lg',
        member.removed_at && 'bg-muted text-muted-foreground',
      )}
    >
      <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
        <MemberBall member={member} className="absolute -inset-[10%]" />
      </div>
      <MemberSprite
        member={member}
        loading="lazy"
        style={{ animationDelay: `${member.position * HOP_STAGGER_MS}ms` }}
        className="absolute inset-x-0 -bottom-[10%] origin-bottom scale-175"
      />
    </li>
  )
}
