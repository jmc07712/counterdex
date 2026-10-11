import type { PokemonType } from '@/api'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { TYPE_STYLES } from './pokemon-types'

export function TypeBadges({ types, className }: { types: PokemonType[]; className?: string }) {
  return (
    <ul aria-label={m.pokemon_types()} className={cn('flex flex-wrap gap-1', className)}>
      {types.map((type) => (
        <li key={type}>
          <Badge
            style={{
              backgroundColor: TYPE_STYLES[type].background,
              color: TYPE_STYLES[type].foreground,
            }}
          >
            {m.pokemon_type({ type })}
          </Badge>
        </li>
      ))}
    </ul>
  )
}
