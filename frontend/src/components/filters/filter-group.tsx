import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type FilterGroupProps = {
  // Names the group's controls, through their aria-labelledby.
  id: string
  label: string
  infoLabel: string
  info: string
  className?: string
  children: ReactNode
}

/**
 * A filter's controls after its label, with an info button that says what the filter does. The
 * button opens a popover rather than a tooltip, so it works on phones too.
 */
export function FilterGroup({ id, label, infoLabel, info, className, children }: FilterGroupProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* As tall as a row of toggles, so the label lines up with the first. */}
      <div className="flex h-7 shrink-0 items-center gap-0.5">
        <span id={id} className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={infoLabel}
              className="text-muted-foreground"
            >
              <Info />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 text-sm">
            {info}
          </PopoverContent>
        </Popover>
      </div>
      {children}
    </div>
  )
}
