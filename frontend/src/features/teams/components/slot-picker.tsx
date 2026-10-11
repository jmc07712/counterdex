import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useDebounceValue, useMediaQuery } from 'usehooks-ts'

import type { Pokemon, TeamMember } from '@/api'
import { listPokemonOptions } from '@/api/@tanstack/react-query.gen'
import { dexNumber, displayName } from '@/components/pokemon/format'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { m } from '@/paraglide/messages.js'

import { cantAdd } from '../utils/can-add'

// Tailwind's md breakpoint: a dialog from here up, a sheet from the bottom on phones.
const DIALOG_FROM = '(min-width: 48rem)'
// Wait for a pause in typing before searching, so each keystroke isn't a request.
const SEARCH_DELAY_MS = 250
const RESULTS = 30

type SlotPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamName: string
  members: TeamMember[]
  onPick: (pokemon: Pokemon) => void
}

export function SlotPicker({ open, onOpenChange, teamName, members, onPick }: SlotPickerProps) {
  const asDialog = useMediaQuery(DIALOG_FROM)
  const body = <PickerBody members={members} onPick={onPick} />

  return asDialog ? (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // A column rather than the dialog's grid, so the results scroll within its height.
        className="flex max-h-[85dvh] flex-col gap-4 sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{m.team_picker_title()}</DialogTitle>
          <DialogDescription>{m.team_picker_description({ team: teamName })}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] gap-4 rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="px-0">
          <SheetTitle>{m.team_picker_title()}</SheetTitle>
          <SheetDescription>{m.team_picker_description({ team: teamName })}</SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  )
}

type PickerProps = {
  members: TeamMember[]
  onPick: (pokemon: Pokemon) => void
}

function PickerBody({ members, onPick }: PickerProps) {
  const [search, setSearch] = useState('')
  const [debounced] = useDebounceValue(search, SEARCH_DELAY_MS)

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <Input
        type="search"
        aria-label={m.team_picker_search()}
        placeholder={m.team_picker_search()}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <PickerResults search={debounced.trim()} members={members} onPick={onPick} />
    </div>
  )
}

function PickerResults({ search, members, onPick }: PickerProps & { search: string }) {
  const results = useQuery({
    ...listPokemonOptions({ query: { q: search || undefined, limit: RESULTS } }),
    // Keep the last results showing while the next search's load.
    placeholderData: keepPreviousData,
  })

  if (results.isPending) return null

  if (results.isError) {
    return <p className="text-sm text-muted-foreground">{m.common_check_connection()}</p>
  }

  if (results.data.items.length === 0) {
    return <p className="text-sm text-muted-foreground">{m.team_picker_empty()}</p>
  }

  return (
    <ul className="-mx-1 flex flex-col overflow-y-auto">
      {results.data.items.map((pokemon) => {
        const reason = cantAdd(members, pokemon)
        return (
          <li key={pokemon.id}>
            <button
              type="button"
              disabled={reason !== null}
              onClick={() => onPick(pokemon)}
              className="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
            >
              <span className="size-10 shrink-0">
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
              <span className="flex-1 font-medium">{displayName(pokemon.name)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {reason ? m.team_cant_add({ reason }) : dexNumber(pokemon.id)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
