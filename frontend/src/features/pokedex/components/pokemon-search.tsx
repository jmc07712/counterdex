import { useCombobox } from 'downshift'
import { Search } from 'lucide-react'
import { useState } from 'react'

import { dexNumber, displayName } from '@/components/pokemon/format'
import { Input } from '@/components/ui/input'
import { useDebouncedSearch } from '@/hooks/use-debounced-search'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { usePokemonSuggestions } from '../hooks/use-pokemon-suggestions'

type PokemonSearchProps = {
  value: string
  onChange: (search: string) => void
  onOpen: (pokemonId: number) => void
}

/** The Pokédex search, suggesting Pokémon as you type; choosing one opens its details. */
export function PokemonSearch({ value, onChange, onOpen }: PokemonSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const search = useDebouncedSearch(value)
  // Only while the list is open: a search in a shared link doesn't load suggestions.
  const suggestions = usePokemonSuggestions(isOpen ? search : '')
  const items = suggestions.data?.items ?? []
  const { highlightedIndex, getLabelProps, getInputProps, getMenuProps, getItemProps } =
    useCombobox({
      items,
      isOpen,
      onIsOpenChange: (changes) => setIsOpen(changes.isOpen ?? false),
      inputValue: value,
      // Never selected, so choosing a suggestion opens it, even the same one twice, and leaves
      // the search as typed.
      selectedItem: null,
      itemToString: (pokemon) => (pokemon ? displayName(pokemon.name) : ''),
      onInputValueChange: ({ inputValue, type }) => {
        if (type === useCombobox.stateChangeTypes.InputChange) onChange(inputValue)
      },
      onSelectedItemChange: ({ selectedItem }) => {
        if (selectedItem) onOpen(selectedItem.id)
      },
    })
  const showSuggestions = isOpen && value.trim() !== '' && items.length > 0

  return (
    <div className="relative flex-1">
      <label {...getLabelProps()} className="sr-only">
        {m.pokedex_search()}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        {...getInputProps({ type: 'search', placeholder: m.pokedex_search(), className: 'pl-8' })}
      />
      <ul
        {...getMenuProps()}
        className={cn(
          'absolute inset-x-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md',
          !showSuggestions && 'hidden',
        )}
      >
        {showSuggestions &&
          items.map((pokemon, index) => (
            <li
              key={pokemon.id}
              {...getItemProps({ item: pokemon, index })}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm',
                highlightedIndex === index && 'bg-accent text-accent-foreground',
              )}
            >
              <span className="size-8 shrink-0">
                {pokemon.sprite_url && (
                  <img
                    src={pokemon.sprite_url}
                    alt=""
                    width={96}
                    height={96}
                    className="size-full object-contain [image-rendering:pixelated]"
                  />
                )}
              </span>
              <span className="font-medium">{displayName(pokemon.name)}</span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {dexNumber(pokemon.id)}
              </span>
            </li>
          ))}
      </ul>
    </div>
  )
}
