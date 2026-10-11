import type { PokemonType } from '@/api'

import { GhostBall } from './poke-ball'
import { TYPE_STYLES } from './pokemon-types'

type TypeBallProps = { types: PokemonType[]; className?: string }

/** A Poké Ball ghosted behind a Pokémon: in its second type's color, or white for a single type. */
export function TypeBall({ types, className }: TypeBallProps) {
  const secondary = types[1]
  return (
    <GhostBall
      color={secondary ? TYPE_STYLES[secondary].background : 'white'}
      className={className}
    />
  )
}
