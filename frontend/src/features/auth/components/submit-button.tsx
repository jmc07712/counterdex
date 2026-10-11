import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

/** aria-disabled rather than disabled while sending, so the button keeps focus. */
export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" size="lg" aria-disabled={pending} className="aria-disabled:opacity-60">
      {children}
    </Button>
  )
}
