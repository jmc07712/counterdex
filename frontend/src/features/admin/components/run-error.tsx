import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { m } from '@/paraglide/messages.js'

/** What went wrong in a failed run, cut to one line. Pressing it opens all of it in a popover. */
export function RunError({ error }: { error: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="max-w-full px-1.5 font-normal text-destructive hover:text-destructive"
        >
          <span className="truncate">{error}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)]">
        <PopoverHeader>
          <PopoverTitle>{m.admin_runs_error()}</PopoverTitle>
        </PopoverHeader>
        <p className="max-h-64 overflow-y-auto font-mono text-xs break-words whitespace-pre-wrap">
          {error}
        </p>
      </PopoverContent>
    </Popover>
  )
}
