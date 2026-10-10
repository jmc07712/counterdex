import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  description?: ReactNode
  // Sits beside the title (under it on phones), such as a status indicator.
  action?: ReactNode
  children?: ReactNode
}

export function PageHeader({ title, description, action, children }: PageHeaderProps) {
  return (
    <div className="mb-8">
      {children}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {action}
      </div>
      {description && <p className="mt-2 max-w-prose text-muted-foreground">{description}</p>}
    </div>
  )
}
