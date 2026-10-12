import { History, SearchX } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router'

import { LoadFailedAlert } from '@/components/load-failed-alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

import { useRunsPage } from '../hooks/use-runs-page'
import { type SyncRuns, useSyncRuns } from '../hooks/use-sync-runs'
import { RunsPagination } from './runs-pagination'
import { SyncRunsList } from './sync-runs-list'
import { SyncRunsTable } from './sync-runs-table'

/** Every sync run, newest first, a page at a time, with the page in the URL. */
export function SyncRunsCard() {
  const titleId = useId()
  const page = useRunsPage()
  const runs = useSyncRuns(page)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 id={titleId} className="text-lg font-bold">
            {m.admin_runs_title()}
          </h2>
        </CardTitle>
        <CardDescription>{m.admin_runs_description()}</CardDescription>
      </CardHeader>
      <CardContent>
        <PageOfRuns runs={runs} page={page} titleId={titleId} />
      </CardContent>
    </Card>
  )
}

type PageOfRunsProps = {
  runs: SyncRuns
  page: number
  // The id of the card's title, which names the runs.
  titleId: string
}

function PageOfRuns({ runs, page, titleId }: PageOfRunsProps) {
  if (runs.isPending) {
    return (
      <ul aria-label={m.admin_runs_loading()} className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((each) => (
          <li key={each}>
            <Skeleton className="h-10" />
          </li>
        ))}
      </ul>
    )
  }

  if (runs.isError) {
    return (
      <LoadFailedAlert title={m.admin_runs_load_failed()} onRetry={() => void runs.refetch()} />
    )
  }

  const { items, total, total_pages: totalPages } = runs.data

  if (total === 0) return <NoRunsYet />
  if (items.length === 0) return <PastTheLastPage page={page} lastPage={totalPages} />

  return (
    <>
      {/* CSS shows one: the table where every column fits, the list on narrower screens. */}
      <SyncRunsTable
        runs={items}
        labelledBy={titleId}
        busy={runs.isPlaceholderData}
        className="max-lg:hidden"
      />
      <SyncRunsList
        runs={items}
        labelledBy={titleId}
        busy={runs.isPlaceholderData}
        className="lg:hidden"
      />
      {totalPages > 1 && <RunsPagination page={page} totalPages={totalPages} />}
    </>
  )
}

function NoRunsYet() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <History />
        </EmptyMedia>
        <EmptyTitle>{m.admin_runs_empty_title()}</EmptyTitle>
        <EmptyDescription>{m.admin_runs_empty_description()}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function PastTheLastPage({ page, lastPage }: { page: number; lastPage: number }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>{m.admin_runs_past_end_title({ page })}</EmptyTitle>
        <EmptyDescription>{m.admin_runs_past_end_description({ last: lastPage })}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link to={paths.admin.getHref({ page: lastPage })}>{m.admin_runs_go_to_last()}</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
