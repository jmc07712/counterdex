import type { ReactNode, Ref } from 'react'

import type { Pokemon, PokemonDetails } from '@/api'
import { BaseStats } from '@/components/pokemon/base-stats'
import { PokemonChip } from '@/components/pokemon/pokemon-chip'
import { TYPE_STYLES } from '@/components/pokemon/pokemon-types'
import { StatTotal } from '@/components/pokemon/stat-total'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/dates'
import { m } from '@/paraglide/messages.js'

import type { PokemonChanges } from '../hooks/use-pokemon-details'
import { ChangeHistory } from './change-history'
import { EvolutionTree } from './evolution-tree'
import { PokemonHero } from './pokemon-hero'

type PokemonDetailsBodyProps = {
  ref: Ref<HTMLDivElement>
  details: PokemonDetails
  // While another form or stage loads, and this one still shows.
  busy: boolean
  changes: PokemonChanges
  onSelect: (pokemonId: number) => void
  action?: (pokemon: Pokemon) => ReactNode
}

/** A Pokémon's hero, base stats, forms, evolution and changes, in the details dialog. */
export function PokemonDetailsBody({
  ref,
  details,
  busy,
  changes,
  onSelect,
  action,
}: PokemonDetailsBodyProps) {
  const { pokemon, species, forms, evolution, removed_at } = details

  return (
    <div
      ref={ref}
      aria-busy={busy}
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
