import type { Pokemon } from '@/api'
import { cn } from '@/lib/utils'

import { ChangedMark } from './changed-mark'
import { displayName } from './format'
import { TYPE_STYLES } from './pokemon-types'

const CHIP = 'inline-flex items-center gap-2 rounded-full border bg-card py-1 pr-3.5 pl-1 text-sm'

type PokemonChipProps = {
  // Null when PokéAPI no longer lists it; the chip then shows `fallbackName` and can't be chosen.
  pokemon: Pokemon | null
  fallbackName: string
  current?: boolean
  onSelect: (pokemonId: number) => void
}

/** A Pokémon's sprite, in a disc of its type's color, and name. Choosing it shows its details. */
export function PokemonChip({
  pokemon,
  fallbackName,
  current = false,
  onSelect,
}: PokemonChipProps) {
  if (!pokemon) {
    return (
      <span className={cn(CHIP, 'pl-3.5 text-muted-foreground')}>{displayName(fallbackName)}</span>
    )
  }
  return (
    <button
      type="button"
      aria-current={current || undefined}
      onClick={() => onSelect(pokemon.id)}
      style={{ '--chip-type': TYPE_STYLES[pokemon.types[0]].background }}
      className={cn(
        CHIP,
        'font-medium transition-colors hover:border-(--chip-type)',
        'aria-[current]:border-(--chip-type) aria-[current]:font-semibold aria-[current]:ring-2 aria-[current]:ring-(--chip-type)/40',
      )}
    >
      <span className="grid size-10 place-items-center rounded-full bg-[color-mix(in_oklab,var(--chip-type)_28%,var(--color-card))]">
        {pokemon.sprite_url && (
          <img
            src={pokemon.sprite_url}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            className="size-10 [image-rendering:pixelated]"
          />
        )}
      </span>
      {displayName(pokemon.name)}
      {pokemon.changed_recently && <ChangedMark />}
    </button>
  )
}
