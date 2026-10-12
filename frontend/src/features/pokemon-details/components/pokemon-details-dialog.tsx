import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useMediaQuery } from 'usehooks-ts'

import type { Pokemon } from '@/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { m } from '@/paraglide/messages.js'

import { usePokemonDetails } from '../hooks/use-pokemon-details'
import { CloseButton } from './close-button'
import { PokemonDetailsBody } from './pokemon-details-body'

// Tailwind's md breakpoint: a dialog from here up, a sheet from the bottom on phones.
const DIALOG_FROM = '(min-width: 48rem)'

type PokemonDetailsDialogProps = {
  // The Pokémon to show; null keeps the dialog closed.
  pokemonId: number | null
  onSelect: (pokemonId: number) => void
  onClose: () => void
  // Under the hero of a Pokémon PokéAPI lists, such as a menu to add it to a team.
  action?: (pokemon: Pokemon) => ReactNode
}

export function PokemonDetailsDialog({
  pokemonId,
  onSelect,
  onClose,
  action,
}: PokemonDetailsDialogProps) {
  const asDialog = useMediaQuery(DIALOG_FROM)
  // Keeps showing the last Pokémon while the dialog animates closed.
  const [shownId, setShownId] = useState(pokemonId)
  if (pokemonId !== null && pokemonId !== shownId) setShownId(pokemonId)

  const open = pokemonId !== null
  const onOpenChange = (isOpen: boolean) => !isOpen && onClose()
  // The hero runs to the edges, so the padding is inside; the close button sits over the hero.
  const content = (
    <>
      <CloseButton />
      {shownId !== null && (
        <PokemonDetails pokemonId={shownId} onSelect={onSelect} action={action} />
      )}
    </>
  )

  return asDialog ? (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-2xl"
      >
        {content}
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]"
      >
        {content}
      </SheetContent>
    </Sheet>
  )
}

type PokemonDetailsProps = {
  pokemonId: number
  onSelect: (pokemonId: number) => void
  action?: (pokemon: Pokemon) => ReactNode
}

function PokemonDetails({ pokemonId, onSelect, action }: PokemonDetailsProps) {
  const { details, changes } = usePokemonDetails(pokemonId)
  const top = useRef<HTMLDivElement>(null)
  const shownPokemonId = details.data?.pokemon.id

  // A newly chosen form or stage starts at the top, wherever the last one was scrolled to.
  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' })
  }, [shownPokemonId])

  if (details.isPending) return <DetailsSkeleton />

  if (details.isError) {
    return (
      <div className="flex flex-col items-start gap-4 p-5 pr-14">
        <DialogHeader>
          <DialogTitle>{m.details_load_failed()}</DialogTitle>
          <DialogDescription>{m.common_check_connection()}</DialogDescription>
        </DialogHeader>
        <Button variant="outline" onClick={() => void details.refetch()}>
          {m.common_try_again()}
        </Button>
      </div>
    )
  }

  return (
    <PokemonDetailsBody
      ref={top}
      details={details.data}
      busy={details.isPlaceholderData}
      changes={changes}
      onSelect={onSelect}
      action={action}
    />
  )
}

function DetailsSkeleton() {
  return (
    <>
      <DialogTitle className="sr-only">{m.details_loading_title()}</DialogTitle>
      <DialogDescription className="sr-only">{m.details_loading_description()}</DialogDescription>
      <Skeleton className="h-44 rounded-none" />
      <div className="flex flex-col gap-3 p-5 sm:p-6">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
    </>
  )
}
