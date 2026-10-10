import { CircleDashed } from 'lucide-react'
import type { ReactNode } from 'react'

import type { Pokemon } from '@/api'
import { cn } from '@/lib/utils'

type SpriteWindowProps = {
  pokemon: Pokemon
  className?: string
  // Shown over the sprite, such as badges in its corners.
  children?: ReactNode
}

/** A Pokémon's sprite, on a panel tinted with the --type-1 color around it. */
export function SpriteWindow({ pokemon, className, children }: SpriteWindowProps) {
  return (
    <div
      className={cn(
        'relative grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-[color-mix(in_oklab,var(--type-1)_18%,var(--color-card))]',
        className,
      )}
    >
      {pokemon.sprite_url ? (
        <img
          src={pokemon.sprite_url}
          alt=""
          width={96}
          height={96}
          loading="lazy"
          decoding="async"
          // Pinned to the window's edges, so its height comes from the window rather than the
          // square image. PokéAPI sprites have transparent padding; scaling up fills it.
          className="absolute inset-0 size-full scale-110 object-contain [image-rendering:pixelated]"
        />
      ) : (
        <CircleDashed aria-hidden="true" className="size-10 text-muted-foreground" />
      )}
      {children}
    </div>
  )
}
