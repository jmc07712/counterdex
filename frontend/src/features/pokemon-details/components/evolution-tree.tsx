import { CornerDownRight } from 'lucide-react'
import { useState } from 'react'

import type { EvolutionMethod, EvolutionStage } from '@/api'
import { PokemonChip } from '@/components/pokemon/pokemon-chip'
import { Button } from '@/components/ui/button'

import { EvolutionMethodChips } from './evolution-method-chips'

// Most stages evolve one or two ways, but Alcremie has 21, so longer lists start folded.
const UNFOLDED_METHODS = 2

type EvolutionTreeProps = {
  first: EvolutionStage
  currentSpeciesId: number | undefined
  onSelect: (pokemonId: number) => void
}

/** An evolution family from its first stage, branching where a species evolves into several. */
export function EvolutionTree({ first, ...stageProps }: EvolutionTreeProps) {
  return (
    <ol aria-label="Evolution" className="flex flex-col gap-3">
      <Stage stage={first} {...stageProps} />
    </ol>
  )
}

type StageProps = Omit<EvolutionTreeProps, 'first'> & { stage: EvolutionStage }

function Stage({ stage, currentSpeciesId, onSelect }: StageProps) {
  return (
    <li className="flex flex-col items-start gap-2">
      {stage.methods.length > 0 && <Methods methods={stage.methods} />}
      <PokemonChip
        pokemon={stage.pokemon}
        fallbackName={stage.species.name}
        current={stage.species.id === currentSpeciesId}
        onSelect={onSelect}
      />
      {stage.evolves_to.length > 0 && (
        <ol className="ml-3 flex flex-col gap-3 border-l pl-4">
          {stage.evolves_to.map((evolution) => (
            <Stage
              key={evolution.species.id}
              stage={evolution}
              currentSpeciesId={currentSpeciesId}
              onSelect={onSelect}
            />
          ))}
        </ol>
      )}
    </li>
  )
}

function Methods({ methods }: { methods: EvolutionMethod[] }) {
  const [unfolded, setUnfolded] = useState(false)
  const shown = unfolded ? methods : methods.slice(0, UNFOLDED_METHODS)

  return (
    <div className="flex items-start gap-1.5 text-muted-foreground">
      <CornerDownRight aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col items-start gap-1">
        {shown.map((method) => (
          // A stage's methods all differ, so each one's fields identify it.
          <EvolutionMethodChips key={JSON.stringify(method)} method={method} />
        ))}
        {methods.length > UNFOLDED_METHODS && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => setUnfolded(!unfolded)}
          >
            {unfolded ? 'Show fewer' : `${methods.length - UNFOLDED_METHODS} more ways`}
          </Button>
        )}
      </div>
    </div>
  )
}
