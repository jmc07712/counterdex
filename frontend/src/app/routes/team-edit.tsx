import { useState } from 'react'
import { useParams } from 'react-router'
import { useMediaQuery } from 'usehooks-ts'

import type { Team } from '@/api'
import { Pokedex } from '@/features/pokedex/components/pokedex'
import { PokemonDetailsDialog } from '@/features/pokemon-details/components/pokemon-details-dialog'
import { useSelectedPokemon } from '@/features/pokemon-details/hooks/use-selected-pokemon'
import { MyTeamsLink } from '@/features/teams/components/back-link'
import { OwnerActions } from '@/features/teams/components/owner-actions'
import { PokedexSheet } from '@/features/teams/components/pokedex-sheet'
import { SavedTeam } from '@/features/teams/components/saved-team'
import { TeamBuilder } from '@/features/teams/components/team-builder'
import { TeamCardAction } from '@/features/teams/components/team-card-action'
import { useTeamEditor } from '@/features/teams/hooks/use-team-editor'
import { m } from '@/paraglide/messages.js'

// Tailwind's lg breakpoint: the Pokédex is beside the team from here up, and opens in a sheet
// below it.
const BESIDE_FROM = '(min-width: 64rem)'

export function TeamEditPage() {
  const { teamId = '' } = useParams()
  const selected = useSelectedPokemon()

  return (
    <>
      <SavedTeam teamId={teamId} onOpenPokemon={selected.open}>
        {(team) => <EditTeam team={team} onOpenPokemon={selected.open} />}
      </SavedTeam>
      <PokemonDetailsDialog
        pokemonId={selected.selected}
        onSelect={selected.show}
        onClose={selected.close}
      />
    </>
  )
}

type EditTeamProps = { team: Team; onOpenPokemon: (pokemonId: number) => void }

// The owner's team, to build from the Pokédex beside it.
function EditTeam({ team, onOpenPokemon }: EditTeamProps) {
  const editor = useTeamEditor(team)
  const beside = useMediaQuery(BESIDE_FROM)
  const [adding, setAdding] = useState(false)

  const builder = (
    <TeamBuilder
      editor={editor}
      back={<MyTeamsLink />}
      actions={<OwnerActions team={team} />}
      onOpenPokemon={onOpenPokemon}
    />
  )
  const pokedex = (
    <Pokedex
      onOpenPokemon={onOpenPokemon}
      cardAction={(pokemon) => <TeamCardAction editor={editor} pokemon={pokemon} />}
    />
  )

  if (beside) {
    return (
      <div className="grid grid-cols-[21rem_minmax(0,1fr)] items-start gap-10">
        {/* Pinned below the header, and as tall as the screen allows, scrolling on its own if the
            team is taller. Its padding keeps the name field's ring inside it. */}
        <div className="sticky top-22 -mx-3 max-h-[calc(100dvh-6.5rem)] overflow-y-auto px-3 pb-4">
          {builder}
        </div>
        <aside aria-label={m.team_add_pokemon()}>{pokedex}</aside>
      </div>
    )
  }
  return (
    // Room after the last slot for the floating Add Pokémon button.
    <div className="pb-16">
      {builder}
      <PokedexSheet teamName={team.name} open={adding} onOpenChange={setAdding}>
        {pokedex}
      </PokedexSheet>
    </div>
  )
}
