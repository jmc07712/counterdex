import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { ResultsStatus } from '@/components/lists/results-status'
import { LoadFailedAlert } from '@/components/load-failed-alert'

type MatchupAnswerProps<T> = {
  // A matchup query, whose answer is null until a sync has stored enough to give one.
  query: UseQueryResult<T | null>
  // What a screen reader hears once an answer loads, such as what it covers.
  summary: (answer: T) => string | null
  // While the first answer loads.
  loading: ReactNode
  // The title of the alert that says the answer didn't load.
  loadFailed: string
  // In place of an answer, while there's no sync to answer from.
  needsSync: ReactNode
  // In place of all of the above while there's nothing to ask, such as for a team with no Pokémon.
  empty?: ReactNode
  children: (answer: T) => ReactNode
}

/**
 * A matchup panel's answer to `query`: `loading`, an alert with Try again if it didn't load,
 * `needsSync`, or `children` with the answer. A status reads out each answer once it has loaded.
 */
export function MatchupAnswer<T>({
  query,
  summary,
  loading,
  loadFailed,
  needsSync,
  empty,
  children,
}: MatchupAnswerProps<T>) {
  function answer() {
    if (query.isPending) return loading
    if (query.isError) {
      return <LoadFailedAlert title={loadFailed} onRetry={() => void query.refetch()} />
    }
    if (query.data === null) return needsSync
    return children(query.data)
  }

  return (
    <>
      {/* Always the first thing returned, from the first load on, so it stays the same element as
          the answer changes. */}
      <ResultsStatus settled={!query.isPlaceholderData}>
        {!empty && query.data && summary(query.data)}
      </ResultsStatus>
      {empty || answer()}
    </>
  )
}
