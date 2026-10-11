import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import type { TeamMember } from '@/api'
import { ChangedMark } from '@/components/pokemon/changed-mark'
import { displayName } from '@/components/pokemon/format'
import { TYPE_STYLES } from '@/components/pokemon/pokemon-types'
import { TypeBadges } from '@/components/pokemon/type-badges'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

type TeamSlotProps = {
  member: TeamMember
  onRemove: () => void
  // Before the sprite, such as a drag handle.
  handle?: ReactNode
}

export function TeamSlot({ member, onRemove, handle }: TeamSlotProps) {
  const { pokemon, removed_at } = member
  const name = displayName(pokemon.name)
  return (
    <div
      style={{ '--type': TYPE_STYLES[pokemon.types[0]].background }}
      className={cn(
        'flex h-full items-center gap-3 rounded-2xl border bg-card p-3',
        removed_at && 'opacity-60 grayscale',
      )}
    >
      {handle}
      <span className="grid size-16 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--type)_28%,var(--color-card))]">
        {pokemon.sprite_url && (
          <img
            src={pokemon.sprite_url}
            alt=""
            width={64}
            height={64}
            className="size-16 scale-110 [image-rendering:pixelated]"
          />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex items-center gap-1 font-semibold">
          <span className="truncate">{name}</span>
          {pokemon.changed_recently && <ChangedMark />}
        </p>
        {removed_at ? (
          <p className="text-xs text-muted-foreground">{m.team_removed_from_pokedex()}</p>
        ) : (
          <TypeBadges types={pokemon.types} />
        )}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={m.team_remove({ name })}
        onClick={onRemove}
      >
        <X />
      </Button>
    </div>
  )
}
