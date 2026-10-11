import { LogOut } from 'lucide-react'
import type { ReactNode } from 'react'

import type { User } from '@/api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSignOut } from '@/lib/auth'
import { m } from '@/paraglide/messages.js'

type AccountMenuProps = {
  user: User
  className?: string
  // Which side of the button the menu opens on.
  side?: 'top' | 'bottom'
  children: ReactNode
}

export function AccountMenu({ user, className, side = 'bottom', children }: AccountMenuProps) {
  const signOut = useSignOut()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={m.account_menu({ username: user.username })}
        className={className}
      >
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="end">
        <DropdownMenuLabel>{m.account_signed_in_as({ username: user.username })}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signOut.isPending}
          // Stays open while signing out, to say if it fails. Once signed out, it's gone.
          onSelect={(event) => {
            event.preventDefault()
            signOut.mutate()
          }}
        >
          <LogOut aria-hidden="true" />
          {signOut.isPending ? m.account_signing_out() : m.account_sign_out()}
        </DropdownMenuItem>
        {signOut.isError && (
          <p role="alert" className="max-w-48 px-1.5 py-1 text-sm text-destructive">
            {m.account_sign_out_failed()}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
