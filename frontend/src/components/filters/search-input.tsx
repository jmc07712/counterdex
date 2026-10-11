import { Search } from 'lucide-react'
import type { ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** A search box with a magnifying glass at its start. */
export function SearchInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <div className="relative">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input type="search" {...props} className={cn('pl-8', className)} />
    </div>
  )
}
