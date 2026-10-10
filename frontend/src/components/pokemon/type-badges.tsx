import type { PokemonType } from '@/api'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { displayName } from './format'
import { TYPE_STYLES } from './pokemon-types'

/** A Pokémon's types as badges in each type's color, primary type first. */
export function TypeBadges({ types, className }: { types: PokemonType[]; className?: string }) {
  return (
    <ul aria-label="Types" className={cn('flex flex-wrap gap-1', className)}>
      {types.map((type) => (
        <li key={type}>
          <Badge
            style={{
              backgroundColor: TYPE_STYLES[type].background,
              color: TYPE_STYLES[type].foreground,
            }}
          >
            {displayName(type)}
          </Badge>
        </li>
      ))}
    </ul>
  )
}
