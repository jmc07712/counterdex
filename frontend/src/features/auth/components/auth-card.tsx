import type { ReactNode } from 'react'

import { Card, CardContent } from '@/components/ui/card'

import { PokedexPanel } from './pokedex-panel'

type AuthCardProps = {
  title: string
  description: string
  busy: boolean
  children: ReactNode
  footer: ReactNode
}

export function AuthCard({ title, description, busy, children, footer }: AuthCardProps) {
  return (
    <Card className="mx-auto w-full max-w-sm gap-0 p-0 shadow-lg md:mt-10 md:max-w-4xl">
      <CardContent className="grid p-0 md:min-h-128 md:grid-cols-2">
        <PokedexPanel busy={busy} />
        <div className="flex flex-col justify-center gap-6 p-6 md:p-10">
          <header>
            <h1 className="text-3xl font-extrabold">{title}</h1>
            <p className="mt-1 text-muted-foreground">{description}</p>
          </header>
          {children}
          <p className="text-center text-sm text-muted-foreground">{footer}</p>
        </div>
      </CardContent>
    </Card>
  )
}
