import type { Pokemon } from '@/api'
import { cn } from '@/lib/utils'

import { displayName } from './format'

const CHIP = 'inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-sm font-medium'

type PokemonChipProps = {
  // Null when PokéAPI no longer lists it; the chip then shows `fallbackName` and can't be chosen.
  pokemon: Pokemon | null
  fallbackName: string
  current?: boolean
  onSelect: (pokemonId: number) => void
}

/** A Pokémon's sprite and name, which shows the Pokémon's details when chosen. */
export function PokemonChip({
  pokemon,
  fallbackName,
  current = false,
  onSelect,
}: PokemonChipProps) {
  if (!pokemon) {
    return <span className={cn(CHIP, 'text-muted-foreground')}>{displayName(fallbackName)}</span>
  }
  return (
    <button
      type="button"
      aria-current={current || undefined}
      onClick={() => onSelect(pokemon.id)}
      className={cn(
        CHIP,
        'transition-colors hover:bg-accent',
        // The open Pokémon, in its type's color.
        'aria-[current]:border-(--type-1) aria-[current]:bg-[color-mix(in_oklab,var(--type-1)_12%,transparent)]',
      )}
    >
      {pokemon.sprite_url && (
        <img
          src={pokemon.sprite_url}
          alt=""
          width={40}
          height={40}
          loading="lazy"
          className="-my-1 size-10 [image-rendering:pixelated]"
        />
      )}
      {displayName(pokemon.name)}
    </button>
  )
}
