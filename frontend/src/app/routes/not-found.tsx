import { Link } from 'react-router'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" description="There's nothing at this address." />
      <Button asChild>
        <Link to="/">Go to the Pokédex</Link>
      </Button>
    </>
  )
}
