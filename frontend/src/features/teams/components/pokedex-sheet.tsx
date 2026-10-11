import { Plus } from 'lucide-react'
import { type ReactNode, useRef } from 'react'

import type { TeamMember } from '@/api'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { m } from '@/paraglide/messages.js'

import { ReplaceBanner } from './replace-banner'

type PokedexSheetProps = {
  teamName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  // The member a Pokémon is being chosen to replace, if any.
  replacing?: TeamMember
  onCancelReplacing: () => void
  // What the sheet holds: the Pokédex.
  children: ReactNode
}

/**
 * A floating Add Pokémon button that opens a sheet as tall as the screen, to add Pokémon from. It
 * stays open as they're added, until Done. While a member is being replaced, a box at its top says
 * so.
 */
export function PokedexSheet({
  teamName,
  open,
  onOpenChange,
  replacing,
  onCancelReplacing,
  children,
}: PokedexSheetProps) {
  const sheet = useRef<HTMLDivElement>(null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          size="lg"
          // Toasts sit above it.
          data-floating-button
          // Above the phone tab bar and the home indicator below it; in the corner from md up,
          // where the tab bar is gone.
          className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 h-11 rounded-full px-4 shadow-lg md:right-6 md:bottom-6"
        >
          <Plus aria-hidden="true" />
          {m.team_add_pokemon()}
        </Button>
      </SheetTrigger>
      <SheetContent
        ref={sheet}
        side="bottom"
        showCloseButton={false}
        // The sheet takes focus itself: focusing its search box would bring up the on-screen
        // keyboard over the Pokédex.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          sheet.current?.focus()
        }}
        // Below the status bar and clear of the screen's rounded corners, and scrolled as a page
        // is, under a header as tall as the app's, which the Pokédex's filters stick below.
        className="gap-0 overflow-y-auto rounded-t-2xl bg-background pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] outline-none data-[side=bottom]:top-[calc(env(safe-area-inset-top)+0.5rem)]"
      >
        <div className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <SheetTitle className="font-heading text-base font-bold">
              {m.team_add_pokemon()}
            </SheetTitle>
            <SheetDescription className="truncate">
              {m.team_pokedex_description({ team: teamName })}
            </SheetDescription>
          </div>
          <SheetClose asChild>
            <Button variant="secondary">{m.team_pokedex_done()}</Button>
          </SheetClose>
        </div>
        <div className="px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
          {replacing && (
            <ReplaceBanner member={replacing} onCancel={onCancelReplacing} className="mb-3" />
          )}
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
