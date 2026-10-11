import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { m } from '@/paraglide/messages.js'

type AddPokemonSheetProps = {
  teamName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  // What the sheet holds: the Pokémon browser.
  children: ReactNode
}

/**
 * A floating "Add Pokémon" button that opens a sheet from the bottom. Adding a Pokémon leaves
 * the sheet open.
 */
export function AddPokemonSheet({ teamName, open, onOpenChange, children }: AddPokemonSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          size="lg"
          // Above the phone tab bar and the home indicator below it; in the corner from md up,
          // where the tab bar is gone.
          className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 h-11 rounded-full px-4 shadow-lg md:right-6 md:bottom-6"
        >
          <Plus aria-hidden="true" />
          {m.team_add_pokemon()}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        // A fixed height, so the list scrolls inside it rather than the sheet growing with it.
        className="gap-3 rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] data-[side=bottom]:h-[85dvh]"
      >
        <SheetHeader className="px-0 pb-0">
          <SheetTitle>{m.team_add_pokemon()}</SheetTitle>
          <SheetDescription>{m.team_browser_description({ team: teamName })}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  )
}
