import { useRef, useState } from 'react'
import { useParams } from 'react-router'
import { useMediaQuery } from 'usehooks-ts'

import type { Team } from '@/api'
import { Pokedex } from '@/features/pokedex/components/pokedex'
import { PokemonDetailsDialog } from '@/features/pokemon-details/components/pokemon-details-dialog'
import { useSelectedPokemon } from '@/features/pokemon-details/hooks/use-selected-pokemon'
import { MyTeamsLink } from '@/features/teams/components/back-link'
import { OwnerActions } from '@/features/teams/components/owner-actions'
import { PokedexSheet } from '@/features/teams/components/pokedex-sheet'
import { ReplaceBanner } from '@/features/teams/components/replace-banner'
import { SavedTeam } from '@/features/teams/components/saved-team'
import { TeamBuilder } from '@/features/teams/components/team-builder'
import { TeamCardAction } from '@/features/teams/components/team-card-action'
import { useReplacing } from '@/features/teams/hooks/use-replacing'
import { useTeamEditor } from '@/features/teams/hooks/use-team-editor'
import { m } from '@/paraglide/messages.js'

// Tailwind's lg breakpoint: the Pokédex is beside the team from here up, and opens in a sheet
// below it. While a member is being replaced, the box asking for a Pokémon is above the Pokédex
// from here up, and above the slots and in the sheet below it.
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
  const replacing = useReplacing(team.members)
  const beside = useMediaQuery(BESIDE_FROM)
  // Open from the start when a member is to be replaced, as the Pokédex is where to choose from.
  const [adding, setAdding] = useState(replacing.member !== undefined)
  const pokedexBeside = useRef<HTMLElement>(null)

  function cancelReplacingBeside() {
    replacing.cancel()
    // Cancel leaves with its box, so focus would fall to the page.
    pokedexBeside.current?.focus()
  }

  const builder = (
    <TeamBuilder
      editor={editor}
      back={<MyTeamsLink />}
      actions={<OwnerActions team={team} />}
      onOpenPokemon={onOpenPokemon}
      replacing={beside ? undefined : replacing.member}
      onCancelReplacing={replacing.cancel}
    />
  )
  const pokedex = (
    <Pokedex
      onOpenPokemon={onOpenPokemon}
      cardAction={(pokemon) => (
        <TeamCardAction editor={editor} pokemon={pokemon} replacing={replacing.member} />
      )}
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
        <aside
          ref={pokedexBeside}
          tabIndex={-1}
          aria-label={m.team_add_pokemon()}
          className="rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {replacing.member && (
            <ReplaceBanner
              member={replacing.member}
              onCancel={cancelReplacingBeside}
              className="mb-3"
            />
          )}
          {pokedex}
        </aside>
      </div>
    )
  }
  return (
    // Room after the last slot for the floating Add Pokémon button.
    <div className="pb-16">
      {builder}
      <PokedexSheet
        teamName={team.name}
        open={adding}
        onOpenChange={setAdding}
        replacing={replacing.member}
        onCancelReplacing={replacing.cancel}
      >
        {pokedex}
      </PokedexSheet>
    </div>
  )
}
