import { Link } from 'react-router'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title={m.not_found_title()} description={m.not_found_description()} />
      <Button asChild>
        <Link to={paths.pokedex.getHref()}>{m.not_found_go_to_pokedex()}</Link>
      </Button>
    </>
  )
}
