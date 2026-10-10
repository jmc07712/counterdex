import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { type ReactNode, useEffect, useRef, useState } from 'react'

import { getPokemonOptions, listPokemonChangesOptions } from '@/api/@tanstack/react-query.gen'
import { BaseStats } from '@/components/pokemon/base-stats'
import { dexNumber, displayName, statTotal } from '@/components/pokemon/format'
import { PokemonChip } from '@/components/pokemon/pokemon-chip'
import { TYPE_STYLES } from '@/components/pokemon/pokemon-types'
import { SpriteWindow } from '@/components/pokemon/sprite-window'
import { TypeBadges } from '@/components/pokemon/type-badges'
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
import { EvolutionTree } from './evolution-tree'

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
        className={cn(
          'max-h-[90dvh] max-w-none gap-5 overflow-y-auto sm:max-w-none md:max-w-2xl',
          SHEET_ON_PHONES,
        )}
      >
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
  const header = useRef<HTMLDivElement>(null)
  const shownPokemonId = details.data?.pokemon.id

  // A newly chosen form or stage starts at the top, with its name, wherever the last one was
  // scrolled to.
  useEffect(() => {
    header.current?.scrollIntoView({ block: 'start' })
  }, [shownPokemonId])

  if (details.isPending) return <DetailsSkeleton />

  if (details.isError) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Couldn’t load this Pokémon</DialogTitle>
          <DialogDescription>Check your connection and try again.</DialogDescription>
        </DialogHeader>
        <Button variant="outline" className="self-start" onClick={() => void details.refetch()}>
          Try again
        </Button>
      </>
    )
  }

  const { pokemon, species, forms, evolution, removed_at } = details.data

  return (
    <div
      aria-busy={details.isPlaceholderData}
      style={{ '--type-1': TYPE_STYLES[pokemon.types[0]].background }}
      className="flex flex-col gap-5 transition-opacity aria-busy:opacity-60"
    >
      {/* Its scroll margin keeps the dialog's top padding when it's scrolled into view. */}
      <DialogHeader ref={header} className="scroll-mt-4">
        <p className="text-xs text-muted-foreground tabular-nums">{dexNumber(pokemon.id)}</p>
        <DialogTitle className="text-xl font-bold">{displayName(pokemon.name)}</DialogTitle>
        <DialogDescription>{species?.genus ?? 'Species not synced yet'}</DialogDescription>
      </DialogHeader>

      {removed_at && (
        <Alert>
          <AlertTitle>Removed from PokéAPI</AlertTitle>
          <AlertDescription>
            PokéAPI stopped listing it on {format(new Date(removed_at), 'PP')}, so this is its data
            from before then.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          {/* Shorter on phones, so the stats are in view too. */}
          <SpriteWindow pokemon={pokemon} className="max-sm:aspect-[2/1]" />
          <TypeBadges types={pokemon.types} />
        </div>
        <div className="flex flex-col gap-2">
          <BaseStats stats={pokemon.stats} className="text-sm" />
          <dl className="flex justify-end gap-1 text-sm text-muted-foreground">
            <dt>Total</dt>
            <dd className="font-semibold text-foreground tabular-nums">
              {statTotal(pokemon.stats)}
            </dd>
          </dl>
        </div>
      </div>

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
            <EvolutionTree first={evolution} currentSpeciesId={species?.id} onSelect={onSelect} />
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
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function DetailsSkeleton() {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="sr-only">Loading Pokémon</DialogTitle>
        <DialogDescription className="sr-only">Its details are on their way.</DialogDescription>
        <Skeleton className="h-6 w-40" />
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="aspect-[4/3]" />
        <Skeleton className="h-32" />
      </div>
    </>
  )
}
