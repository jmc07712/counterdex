import { ArrowLeft, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import { useMediaQuery } from 'usehooks-ts'

import type { Pokemon } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { Button } from '@/components/ui/button'
import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

import type { TeamEditor } from '../types'
import { addToTeam } from '../utils/add-to-team'
import { AddPokemonSheet } from './add-pokemon-sheet'
import { PokemonBrowser } from './pokemon-browser'
import { TeamNameField } from './team-name-field'
import { EmptySlots, TeamSlot, TeamSlots } from './team-slots'

// Tailwind's lg breakpoint: the browser sits beside the team from here up, and opens in a sheet
// from the bottom below it.
const TWO_PANES_FROM = '(min-width: 64rem)'

type TeamBuilderProps = {
  editor: TeamEditor
  // Beside the name, such as a menu with Delete.
  actions?: ReactNode
}

/** A team's name and six slots, beside a browser of Pokémon to add to it. */
export function TeamBuilder({ editor, actions }: TeamBuilderProps) {
  const twoPanes = useMediaQuery(TWO_PANES_FROM)
  const [adding, setAdding] = useState(false)
  const { team } = editor

  function add(pokemon: Pokemon) {
    // With two panes the team is in view already. With the sheet, View closes it to show the team.
    const view = twoPanes ? undefined : () => setAdding(false)
    void addToTeam(editor, pokemon, { teamName: team.name, view })
  }

  const browser = <PokemonBrowser members={team.members} onAdd={add} />

  return (
    // Below lg, room after the last slot for the floating Add Pokémon button.
    <div className="grid gap-8 pb-16 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:pb-0">
      <div>
        <Link
          to={paths.home.getHref()}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {m.team_all_teams()}
        </Link>
        <div className="mb-6 flex items-center gap-2">
          <TeamNameField name={team.name} onRename={(name) => void editor.rename(name)} />
          {actions}
        </div>
        <TeamSlots>
          {team.members.map((member) => (
            <TeamSlot key={member.pokemon.id} member={member}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={m.team_remove({ name: displayName(member.pokemon.name) })}
                onClick={() => void editor.remove(member.pokemon.id)}
              >
                <X />
              </Button>
            </TeamSlot>
          ))}
          <EmptySlots filled={team.members.length} />
        </TeamSlots>
      </div>
      {twoPanes ? (
        <aside
          aria-label={m.team_add_pokemon()}
          // Pinned below the header, as tall as the screen allows; its list scrolls on its own.
          className="sticky top-20 flex h-[calc(100dvh-6.5rem)] flex-col gap-3 rounded-2xl border bg-card p-4"
        >
          <h2 className="font-heading text-lg font-bold">{m.team_add_pokemon()}</h2>
          {browser}
        </aside>
      ) : (
        <AddPokemonSheet teamName={team.name} open={adding} onOpenChange={setAdding}>
          {browser}
        </AddPokemonSheet>
      )}
    </div>
  )
}
