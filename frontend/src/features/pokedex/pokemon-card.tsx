import { CircleDashed } from 'lucide-react'
import { useId } from 'react'
import Tilt from 'react-parallax-tilt'
import { useMediaQuery } from 'usehooks-ts'

import type { Pokemon, Stats } from '@/api'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

import { dexNumber, displayName, formLabel, statTotal } from './format'
import { TYPE_STYLES } from './pokemon-types'

// A label for each base stat, in the API's order. A Record, so a new stat needs a label.
const STAT_LABELS: Record<keyof Stats, string> = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  sp_attack: 'Sp. Atk',
  sp_defense: 'Sp. Def',
  speed: 'Speed',
}
const STATS = Object.keys(STAT_LABELS) as (keyof Stats)[]

// Bars measure against the highest base stat the API allows, so they compare across cards.
const MAX_BASE_STAT = 255

// Tilt and foil follow a mouse. On touch screens cards would tilt while scrolling, and some
// people ask their OS for less motion.
const TILT_MEDIA_QUERY = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'

type PokemonCardProps = {
  pokemon: Pokemon
  // PokéAPI no longer lists it.
  removed?: boolean
}

export function PokemonCard({ pokemon, removed = false }: PokemonCardProps) {
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
        className="h-full rounded-2xl p-1.5 [background:linear-gradient(135deg,var(--type-1)_50%,var(--type-2)_50%)]"
      >
        <Card size="sm" className="h-full gap-2 ring-0">
          <CardHeader>
            <CardTitle>
              <h3 id={headingId} className="line-clamp-2 font-bold">
                {displayName(pokemon.name)}
              </h3>
            </CardTitle>
            <CardDescription className="text-xs tabular-nums">{dexNumber(pokemon.id)}</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-1 flex-col gap-2">
            <ul aria-label="Types" className="flex flex-wrap gap-1">
              {pokemon.types.map((type) => (
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

            <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-[color-mix(in_oklab,var(--type-1)_18%,var(--color-card))]">
              {pokemon.sprite_url ? (
                <img
                  src={pokemon.sprite_url}
                  alt=""
                  width={96}
                  height={96}
                  loading="lazy"
                  decoding="async"
                  // Pinned to the window's edges, so its height comes from the window rather than
                  // the square image. PokéAPI sprites have transparent padding; scaling up fills it.
                  className="absolute inset-0 size-full scale-110 object-contain [image-rendering:pixelated]"
                />
              ) : (
                <CircleDashed aria-hidden="true" className="size-10 text-muted-foreground" />
              )}
              {form && (
                <Badge variant="secondary" className="absolute top-1.5 left-1.5">
                  {form}
                </Badge>
              )}
              {removed && (
                <Badge variant="destructive" className="absolute top-1.5 right-1.5">
                  Removed
                </Badge>
              )}
            </div>

            <dl className="mt-auto flex flex-col gap-1 text-xs">
              {STATS.map((stat) => (
                <div key={stat} className="flex items-center gap-2">
                  <dt className="w-12 shrink-0 text-muted-foreground">{STAT_LABELS[stat]}</dt>
                  <dd className="flex flex-1 items-center gap-2">
                    <Progress
                      aria-hidden="true"
                      value={(pokemon.stats[stat] / MAX_BASE_STAT) * 100}
                      className="*:data-[slot=progress-indicator]:bg-(--type-1)"
                    />
                    <span className="w-6 text-right tabular-nums">{pokemon.stats[stat]}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>

          <CardFooter className="justify-end text-xs">
            <dl className="flex gap-1 text-muted-foreground">
              <dt>Total</dt>
              <dd className="font-semibold text-foreground tabular-nums">
                {statTotal(pokemon.stats)}
              </dd>
            </dl>
          </CardFooter>
        </Card>
      </article>
    </Tilt>
  )
}
