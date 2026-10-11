import { type ReactNode, useId } from 'react'
import { Link } from 'react-router'

import type { TeamMember } from '@/api'
import { ChangedMark } from '@/components/pokemon/changed-mark'
import { displayName } from '@/components/pokemon/format'
import { PokeBall } from '@/components/pokemon/poke-ball'
import { TypeBadges } from '@/components/pokemon/type-badges'
import { formatDate, formatList } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { MAX_TEAM_SIZE } from '../utils/can-add'
import { memberColors, MUTED } from '../utils/member-colors'
import { teamTypes } from '../utils/team-types'
import { MemberBall } from './member-ball'
import { MemberSprite } from './member-sprite'
import { TeamPower } from './team-power'

// On hover or focus, the sprites hop one after another, this far apart.
const HOP_STAGGER_MS = 60

type TeamCardProps = {
  to: string
  name: string
  members: TeamMember[]
  // Shown under the name, such as "Not saved".
  note?: string
  // Beside its power, over the link, such as a button to build a counter to it.
  action?: ReactNode
}

export function TeamCard({ to, name, members, note, action }: TeamCardProps) {
  const nameId = useId()
  const summaryId = useId()
  const powerId = useId()
  const changed = members.some((member) => member.pokemon.changed_recently)
  const types = teamTypes(members)
  return (
    <article
      aria-labelledby={nameId}
      // As tall as its grid cell, so the cards in a row are as tall as the tallest.
      className="group/hop relative flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-foreground/30"
    >
      <div id={summaryId} className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id={nameId} className="flex min-w-0 items-center gap-1 font-heading text-lg font-bold">
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
        {members.filter(isRemoved).map((member) => (
          <p key={member.pokemon.id} className="text-xs text-muted-foreground">
            {m.team_member_removed_on({
              name: displayName(member.pokemon.name),
              date: formatDate(member.removed_at),
            })}
          </p>
        ))}
        {types.length > 0 && (
          <>
            <p className="sr-only">
              {m.team_types({ types: formatList(types.map((type) => m.pokemon_type({ type }))) })}
            </p>
            {/* Hidden like the tiles: a list's label would stand in for its types in the link's
                name, so the line above names them. */}
            <div aria-hidden="true">
              <TypeBadges types={types} />
            </div>
          </>
        )}
      </div>
      {/* Over the whole card, so all of it opens the team. It's named by what the card shows:
          the summary above, then the power. */}
      <Link
        to={to}
        aria-labelledby={`${summaryId} ${powerId}`}
        className="absolute -inset-px rounded-[inherit] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {/* At the card's bottom, level with the power bars of the other cards in its row. */}
      <div className="mt-auto flex items-center gap-3">
        <div id={powerId} className="min-w-0 flex-1">
          <TeamPower members={members} />
        </div>
        {/* Over the link, so it can be pressed on its own. A button overhangs the power's row
            rather than making the card taller than one without. */}
        {action && <div className="relative z-10 -my-1.5 shrink-0">{action}</div>}
      </div>
    </article>
  )
}

function isRemoved(member: TeamMember): member is TeamMember & { removed_at: string } {
  return member.removed_at !== null
}

// A member's tile, in its main type's color, or neutral once it's no longer in the Pokédex. Its
// sprite stands on the tile and rises over its top edge.
function MemberTile({ member }: { member: TeamMember }) {
  const colors = memberColors(member)
  return (
    <li
      style={{ backgroundColor: colors?.background }}
      className={cn('relative aspect-square rounded-lg', !colors && MUTED)}
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
