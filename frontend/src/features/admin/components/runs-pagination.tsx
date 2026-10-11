import { ChevronLeft, ChevronRight, Ellipsis } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

import { pageNumbers } from '../utils/page-numbers'

type RunsPaginationProps = {
  page: number
  totalPages: number
}

/** Links to the other pages of sync runs: the one before and after, and pages by number. */
export function RunsPagination({ page, totalPages }: RunsPaginationProps) {
  return (
    <nav
      aria-label={m.admin_runs_pages()}
      className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between"
    >
      {/* A status, so moving to another page is read out. */}
      <p role="status" className="text-sm text-muted-foreground tabular-nums">
        {m.admin_runs_page_of({ page, total: totalPages })}
      </p>
      <ul className="flex items-center gap-1">
        <li>
          <StepLink page={Math.max(page - 1, 1)} disabled={page === 1} rel="prev">
            <ChevronLeft aria-hidden="true" />
            <span className="max-sm:sr-only">{m.admin_runs_previous()}</span>
          </StepLink>
        </li>
        {pageNumbers(page, totalPages).map((each, index) =>
          each === 'gap' ? (
            <li
              key={`gap-${index}`}
              aria-hidden="true"
              className="flex size-7 items-center justify-center text-muted-foreground"
            >
              <Ellipsis className="size-4" />
            </li>
          ) : (
            <li key={each}>
              <Button asChild variant={each === page ? 'outline' : 'ghost'} size="icon-sm">
                <Link
                  to={paths.admin.getHref({ page: each })}
                  aria-label={m.admin_runs_page({ page: each })}
                  aria-current={each === page ? 'page' : undefined}
                  className="tabular-nums"
                >
                  {each}
                </Link>
              </Button>
            </li>
          ),
        )}
        <li>
          <StepLink
            page={Math.min(page + 1, totalPages)}
            disabled={page === totalPages}
            rel="next"
          >
            <span className="max-sm:sr-only">{m.admin_runs_next()}</span>
            <ChevronRight aria-hidden="true" />
          </StepLink>
        </li>
      </ul>
    </nav>
  )
}

type StepLinkProps = {
  page: number
  // At either end, where there's no page to go to.
  disabled: boolean
  rel: 'prev' | 'next'
  children: ReactNode
}

// Disabled, it's still the same link, so focus stays on it after it reaches the first or last page.
function StepLink({ page, disabled, rel, children }: StepLinkProps) {
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
    >
      <Link
        to={paths.admin.getHref({ page })}
        rel={rel}
        aria-disabled={disabled || undefined}
        onClick={(event) => {
          if (disabled) event.preventDefault()
        }}
      >
        {children}
      </Link>
    </Button>
  )
}
