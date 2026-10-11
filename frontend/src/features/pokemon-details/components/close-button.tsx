import { XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DialogClose } from '@/components/ui/dialog'
import { m } from '@/paraglide/messages.js'

/**
 * Closes the details. A frosted disc, so it reads on any type's color as well as on plain ones,
 * pinned in a zero-height bar so it stays in reach while the details scroll.
 */
export function CloseButton() {
  return (
    <div className="sticky top-0 z-10 h-0">
      <DialogClose asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-3 right-3 rounded-full bg-background/70 backdrop-blur-sm hover:bg-background"
        >
          <XIcon />
          <span className="sr-only">{m.details_close()}</span>
        </Button>
      </DialogClose>
    </div>
  )
}
