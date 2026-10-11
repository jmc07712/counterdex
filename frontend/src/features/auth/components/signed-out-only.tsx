import type { ReactNode } from 'react'
import { Navigate } from 'react-router'

import { paths } from '@/config/paths'
import { useCurrentUser } from '@/lib/auth'

import { useNextPath } from '../hooks/use-next-path'

export function SignedOutOnly({ children }: { children: ReactNode }) {
  const next = useNextPath()
  const { data: user, isPending } = useCurrentUser()

  if (isPending) return null
  if (user) return <Navigate to={next ?? paths.home.getHref()} replace />
  return children
}
