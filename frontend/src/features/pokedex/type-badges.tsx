import type { PokemonType } from '@/api'
import { Badge } from '@/components/ui/badge'

import { displayName } from './format'
import { TYPE_STYLES } from './pokemon-types'

/** A Pokémon's types as badges in each type's color, primary type first. */
export function TypeBadges({ types }: { types: PokemonType[] }) {
  return (
    <ul aria-label="Types" className="flex flex-wrap gap-1">
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
