import type { Pokemon, Species } from '@/api'
import { ChangedMark } from '@/components/pokemon/changed-mark'
import { dexNumber, displayName } from '@/components/pokemon/format'
import { PokeBall } from '@/components/pokemon/poke-ball'
import { TYPE_STYLES } from '@/components/pokemon/pokemon-types'
import { TypeBadges } from '@/components/pokemon/type-badges'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'

type PokemonHeroProps = { pokemon: Pokemon; species: Species | null }

/**
 * The top of a Pokémon's details, like a Pokédex entry: its number, name, genus and types on its
 * primary type's color, beside its sprite. A Poké Ball behind the sprite takes its second type's
 * color, or white for a single-type Pokémon.
 */
export function PokemonHero({ pokemon, species }: PokemonHeroProps) {
  const [primary, secondary] = pokemon.types
  const { background, foreground } = TYPE_STYLES[primary]

  return (
    <header
      style={{ backgroundColor: background, color: foreground }}
      className="relative isolate overflow-hidden px-5 pt-5 pb-4 sm:px-6"
    >

      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1 pb-1">
          <p className="flex items-center gap-1 font-heading text-sm font-bold tabular-nums">
            <span className="opacity-70">{dexNumber(pokemon.id)}</span>
            {pokemon.changed_recently && <ChangedMark className="text-current" />}
          </p>
          <DialogTitle className="font-heading text-2xl leading-tight font-extrabold text-balance sm:text-3xl">
            {displayName(pokemon.name)}
          </DialogTitle>
          <DialogDescription className="text-current opacity-80">
            {species?.genus ?? 'Species not synced yet'}
          </DialogDescription>
          {/* Ringed, so a badge in the hero's own color still stands out. */}
          <TypeBadges
            types={pokemon.types}
            className="mt-2 *:*:data-[slot=badge]:ring-2 *:*:data-[slot=badge]:ring-white/80"
          />
        </div>
        <div className="relative isolate -my-1 grid size-32 shrink-0 place-items-center sm:size-40">
          {/* Half again as wide as the sprite, so its band shows either side of the Pokémon. */}
          <PokeBall
            style={{ color: secondary ? TYPE_STYLES[secondary].background : 'white' }}
            className="absolute -inset-1/4 -z-10 opacity-40"
          />
          {pokemon.sprite_url && (
            <img
              src={pokemon.sprite_url}
              alt=""
              width={96}
              height={96}
              // PokéAPI sprites have transparent margins; scaling up fills them.
              className="size-full scale-125 object-contain drop-shadow-[0_6px_6px_rgb(0_0_0/0.3)] [image-rendering:pixelated]"
            />
          )}
        </div>
      </div>
    </header>
  )
}
