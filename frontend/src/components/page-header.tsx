import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  description?: ReactNode
  // A line under the description, such as when the data was last updated.
  meta?: ReactNode
  children?: ReactNode
}

export function PageHeader({ title, description, meta, children }: PageHeaderProps) {
  return (
    <div className="mb-8">
      {children}
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      {description && <p className="mt-2 max-w-prose text-muted-foreground">{description}</p>}
      {meta && <div className="mt-3">{meta}</div>}
    </div>
  )
}
