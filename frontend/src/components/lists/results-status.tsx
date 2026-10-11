import type { ReactNode } from 'react'

type ResultsStatusProps = {
  // False while results load: the first, or new ones while the last stay on screen.
  settled: boolean
  // What to say once settled. Nothing while the first results load.
  children?: ReactNode
}

/**
 * Tells screen readers what a list shows, such as how many results, once its results have loaded.
 * It's empty while results load, so results that had to load are read out even when they're
 * worded as the last were. Results the app already has show at once, and are read out only if
 * their words change.
 */
export function ResultsStatus({ settled, children }: ResultsStatusProps) {
  return (
    <p role="status" className="sr-only">
      {settled && children}
    </p>
  )
}
