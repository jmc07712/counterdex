import { ShieldX } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { paths } from '@/config/paths'
import { useCurrentUser } from '@/lib/auth'
import { m } from '@/paraglide/messages.js'

/**
 * Shows `children` to admins, and tells everyone else the page is for admins. The API's 403 is
 * what keeps admin data from anyone else; this only shows the right page.
 */
export function AdminOnly({ children }: { children: ReactNode }) {
  const currentUser = useCurrentUser()

  if (currentUser.isPending) return <Skeleton className="h-96 rounded-xl" />
  if (currentUser.data?.is_admin) return children

  if (currentUser.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{m.admin_session_check_failed()}</AlertTitle>
        <AlertDescription>{m.common_check_connection()}</AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={() => void currentUser.refetch()}>
            {m.common_try_again()}
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldX />
        </EmptyMedia>
        <EmptyTitle>{m.admin_only()}</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link to={paths.home.getHref()}>{m.admin_go_to_teams()}</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
