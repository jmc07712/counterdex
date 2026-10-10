import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { type ReactNode, useEffect, useRef, useState } from 'react'

import { getPokemonOptions, listPokemonChangesOptions } from '@/api/@tanstack/react-query.gen'
import { BaseStats } from '@/components/pokemon/base-stats'
import { statTotal } from '@/components/pokemon/format'
import { PokemonChip } from '@/components/pokemon/pokemon-chip'
import { TYPE_STYLES } from '@/components/pokemon/pokemon-types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { ChangeHistory } from './change-history'
import { CloseButton } from './close-button'
import { EvolutionTree } from './evolution-tree'
import { PokemonHero } from './pokemon-hero'

// Below md, a sheet along the bottom of the screen that slides up, as in phone apps; from md up,
// a dialog in the middle.
const SHEET_ON_PHONES = cn(
  'max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:translate-x-0 max-md:translate-y-0',
  'max-md:rounded-b-none max-md:pb-[max(1rem,env(safe-area-inset-bottom))]',
  'max-md:data-open:slide-in-from-bottom max-md:data-closed:slide-out-to-bottom',
  'max-md:data-open:zoom-in-100 max-md:data-closed:zoom-out-100',
)

type PokemonDetailsDialogProps = {
  // The Pokémon to show; null keeps the dialog closed.
  pokemonId: number | null
  onSelect: (pokemonId: number) => void
  onClose: () => void
}

export function PokemonDetailsDialog({ pokemonId, onSelect, onClose }: PokemonDetailsDialogProps) {
  // Keeps showing the last Pokémon while the dialog animates closed.
  const [shownId, setShownId] = useState(pokemonId)
  if (pokemonId !== null && pokemonId !== shownId) setShownId(pokemonId)

  return (
    <Dialog open={pokemonId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        // The hero runs to the edges, so the padding goes inside; the close button sits over it.
        showCloseButton={false}
        className={cn(
          'max-h-[90dvh] max-w-none gap-0 overflow-y-auto p-0 sm:max-w-none md:max-w-2xl',
          SHEET_ON_PHONES,
        )}
      >
        <CloseButton />
        {shownId !== null && <PokemonDetails pokemonId={shownId} onSelect={onSelect} />}
      </DialogContent>
    </Dialog>
  )
}

function PokemonDetails({
  pokemonId,
  onSelect,
}: {
  pokemonId: number
  onSelect: (pokemonId: number) => void
}) {
  const path = { pokemon_id: pokemonId }
  // Choosing another form or stage keeps this one showing until the next arrives, rather than
  // flashing a skeleton in between.
  const details = useQuery({ ...getPokemonOptions({ path }), placeholderData: keepPreviousData })
  const changes = useQuery({
    ...listPokemonChangesOptions({ path }),
    placeholderData: keepPreviousData,
  })
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
          <DialogTitle>Couldn’t load this Pokémon</DialogTitle>
          <DialogDescription>Check your connection and try again.</DialogDescription>
        </DialogHeader>
        <Button variant="outline" onClick={() => void details.refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const { pokemon, species, forms, evolution, removed_at } = details.data

  return (
    <div
      ref={top}
      aria-busy={details.isPlaceholderData}
      style={{ '--type-1': TYPE_STYLES[pokemon.types[0]].background }}
      className="flex flex-col transition-opacity aria-busy:opacity-60"
    >
      <PokemonHero pokemon={pokemon} species={species} />

      <div className="flex flex-col gap-6 p-5 max-md:pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
        {removed_at && (
          <Alert>
            <AlertTitle>Removed from PokéAPI</AlertTitle>
            <AlertDescription>
              PokéAPI stopped listing it on {format(new Date(removed_at), 'PP')}, so this is its
              data from before then.
            </AlertDescription>
          </Alert>
        )}

        <Section title="Base stats">
          <div className="flex flex-col gap-2 rounded-xl bg-muted/60 p-4">
            <BaseStats
              stats={pokemon.stats}
              className="gap-2 text-sm [&_[data-slot=progress]]:h-2"
            />
            <dl className="flex justify-end gap-1 text-sm text-muted-foreground">
              <dt>Total</dt>
              <dd className="font-semibold text-foreground tabular-nums">
                {statTotal(pokemon.stats)}
              </dd>
            </dl>
          </div>
        </Section>

        {forms.length > 1 && (
          <Section title="Forms">
            <ul aria-label="Forms" className="flex flex-wrap gap-2">
              {forms.map((form) => (
                <li key={form.id}>
                  <PokemonChip
                    pokemon={form}
                    fallbackName={form.name}
                    current={form.id === pokemon.id}
                    onSelect={onSelect}
                  />
                </li>
              ))}
            </ul>
          </Section>
        )}

        {evolution && (
          <Section title="Evolution">
            {evolution.evolves_to.length > 0 ? (
              <EvolutionTree
                first={evolution}
                currentSpeciesId={species?.id}
                onSelect={onSelect}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Doesn’t evolve.</p>
            )}
          </Section>
        )}

        <Section title="Changes">
          {changes.isPending ? (
            <Skeleton className="h-6 w-2/3" />
          ) : changes.isError ? (
            <p className="text-sm text-muted-foreground">Couldn’t load its changes.</p>
          ) : (
            <ChangeHistory changes={changes.data} />
          )}
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-heading text-base font-bold">{title}</h3>
      {children}
    </section>
  )
}

function DetailsSkeleton() {
  return (
    <>
      <DialogTitle className="sr-only">Loading Pokémon</DialogTitle>
      <DialogDescription className="sr-only">Its details are on their way.</DialogDescription>
      <Skeleton className="h-44 rounded-none" />
      <div className="flex flex-col gap-3 p-5 sm:p-6">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
    </>
  )
}
