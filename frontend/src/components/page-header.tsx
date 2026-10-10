import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  description?: ReactNode
  children?: ReactNode
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="mb-8">
      {children}
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      {description && <p className="mt-2 max-w-prose text-muted-foreground">{description}</p>}
    </div>
  )
}
