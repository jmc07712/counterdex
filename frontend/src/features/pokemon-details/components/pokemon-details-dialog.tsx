import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useMediaQuery } from 'usehooks-ts'

import type { Pokemon } from '@/api'
import { getPokemonOptions, listPokemonChangesOptions } from '@/api/@tanstack/react-query.gen'
import { BaseStats } from '@/components/pokemon/base-stats'
import { PokemonChip } from '@/components/pokemon/pokemon-chip'
import { TYPE_STYLES } from '@/components/pokemon/pokemon-types'
import { StatTotal } from '@/components/pokemon/stat-total'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { formatDate } from '@/lib/dates'
import { Skeleton } from '@/components/ui/skeleton'
import { m } from '@/paraglide/messages.js'

import { ChangeHistory } from './change-history'
import { CloseButton } from './close-button'
import { EvolutionTree } from './evolution-tree'
import { PokemonHero } from './pokemon-hero'

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
          <DialogTitle>{m.details_load_failed()}</DialogTitle>
          <DialogDescription>{m.common_check_connection()}</DialogDescription>
        </DialogHeader>
        <Button variant="outline" onClick={() => void details.refetch()}>
          {m.common_try_again()}
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

      <div className="flex flex-col gap-6 p-5 sm:p-6">
        {action && !removed_at && <div>{action(pokemon)}</div>}
        {removed_at && (
          <Alert>
            <AlertTitle>{m.pokemon_removed_from_pokeapi()}</AlertTitle>
            <AlertDescription>
              {m.details_removed_description({ date: formatDate(removed_at) })}
            </AlertDescription>
          </Alert>
        )}

        <Section title={m.details_base_stats()}>
          <div className="flex flex-col gap-2 rounded-xl bg-muted/60 p-4">
            <BaseStats
              stats={pokemon.stats}
              className="gap-2 text-sm [&_[data-slot=progress]]:h-2"
            />
            <StatTotal stats={pokemon.stats} className="justify-end text-sm" />
          </div>
        </Section>

        {forms.length > 1 && (
          <Section title={m.details_forms()}>
            <ul aria-label={m.details_forms()} className="flex flex-wrap gap-2">
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
          <Section title={m.details_evolution()}>
            {evolution.evolves_to.length > 0 ? (
              <EvolutionTree
                first={evolution}
                currentSpeciesId={species?.id}
                onSelect={onSelect}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{m.details_no_evolution()}</p>
            )}
          </Section>
        )}

        <Section title={m.details_changes()}>
          {changes.isPending ? (
            <Skeleton className="h-6 w-2/3" />
          ) : changes.isError ? (
            <p className="text-sm text-muted-foreground">{m.details_changes_load_failed()}</p>
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
