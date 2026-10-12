import { type ReactNode, useId } from 'react'
import Tilt from 'react-parallax-tilt'
import { useMediaQuery } from 'usehooks-ts'

import type { Pokemon } from '@/api'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { BaseStats } from './base-stats'
import { ChangedMark } from './changed-mark'
import { dexNumber, displayName, formLabel } from './format'
import { TYPE_STYLES } from './pokemon-types'
import { SpriteWindow } from './sprite-window'
import { StatTotal } from './stat-total'
import { TypeBadges } from './type-badges'

// Tilt and foil follow a mouse. On touch screens cards would tilt while scrolling, and some
// people ask their OS for less motion.
const TILT_MEDIA_QUERY = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'

type PokemonCardProps = {
  pokemon: Pokemon
  // PokéAPI no longer lists it.
  removed?: boolean
  onOpen?: () => void
  // At its foot, under its stat total, such as a button to add it to a team.
  action?: ReactNode
}

export function PokemonCard({ pokemon, removed = false, onOpen, action }: PokemonCardProps) {
  const headingId = useId()
  const canTilt = useMediaQuery(TILT_MEDIA_QUERY)
  const [primary, secondary = primary] = pokemon.types
  const form = formLabel(pokemon)

  return (
    <Tilt
      tiltEnable={canTilt}
      tiltMaxAngleX={7}
      tiltMaxAngleY={7}
      glareEnable={canTilt}
      // White glare can't be seen on a light card, so in light mode it's tinted with the card's
      // main type, like holo foil.
      glareColor={`light-dark(${TYPE_STYLES[primary].background}, white)`}
      glareMaxOpacity={0.3}
      glarePosition="all"
      glareBorderRadius="16px"
      className="h-full"
    >
      <article
        aria-labelledby={headingId}
        style={{
          '--type-1': TYPE_STYLES[primary].background,
          '--type-2': TYPE_STYLES[secondary].background,
        }}
        className="relative h-full rounded-2xl p-1.5 [background:linear-gradient(135deg,var(--type-1)_50%,var(--type-2)_50%)] has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
      >
        <Card size="sm" className="h-full gap-2 ring-0">
          <CardHeader>
            <CardTitle>
              <h3 id={headingId} className="line-clamp-2 font-bold">
                {displayName(pokemon.name)}
              </h3>
            </CardTitle>
            <CardDescription className="flex items-center gap-1 text-xs tabular-nums">
              {dexNumber(pokemon.id)}
              {pokemon.changed_recently && <ChangedMark />}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-1 flex-col gap-2">
            <TypeBadges types={pokemon.types} />

            <SpriteWindow pokemon={pokemon}>
              {form && (
                <Badge variant="secondary" className="absolute top-1.5 left-1.5">
                  {form}
                </Badge>
              )}
              {removed && (
                <Badge variant="destructive" className="absolute top-1.5 right-1.5">
                  {m.pokemon_removed()}
                </Badge>
              )}
            </SpriteWindow>

            {/* Not pinned to the footer, which an action's note can make taller than its row's. */}
            <BaseStats stats={pokemon.stats} />
          </CardContent>

          <CardFooter
            className={cn('justify-end text-xs', action && 'flex-col items-stretch gap-2')}
          >
            <StatTotal stats={pokemon.stats} className="self-end" />
            {/* Over the open button, so it can be pressed on its own. */}
            {action && <div className="relative z-10">{action}</div>}
          </CardFooter>
        </Card>
        {onOpen && (
          // Over the whole card, so all of it opens the details. It's named by the card's
          // heading, so it reads as "Charizard, button".
          <button
            type="button"
            aria-labelledby={headingId}
            onClick={onOpen}
            className="absolute inset-0 rounded-2xl outline-none"
          />
        )}
      </article>
    </Tilt>
  )
}
