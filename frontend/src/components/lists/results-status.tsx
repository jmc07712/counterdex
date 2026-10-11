import type { ReactNode } from 'react'

type ResultsStatusProps = {
  // False while the last results stay on screen as new ones load.
  settled: boolean
  // What to say once settled. Nothing while the first results load.
  children?: ReactNode
}

/**
 * Tells screen readers what a list shows, such as how many results, once new results have
 * loaded. While they load it's empty, so the next results are read out even if they're worded
 * the same as the last.
 */
export function ResultsStatus({ settled, children }: ResultsStatusProps) {
  return (
    <p role="status" className="sr-only">
      {settled && children}
    </p>
  )
}
