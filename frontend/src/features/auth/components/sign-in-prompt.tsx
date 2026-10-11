import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

type SignInPromptProps = {
  icon: ReactNode
  title: string
  description: string
  // Where to come back to after signing in or up.
  next: string
}

export function SignInPrompt({ icon, title, description, next }: SignInPromptProps) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2">
        <Button asChild>
          <Link to={paths.signIn.getHref(next)}>{m.auth_go_to_sign_in()}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={paths.signUp.getHref(next)}>{m.auth_go_to_sign_up()}</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
