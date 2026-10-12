import { X } from 'lucide-react'
import { Link } from 'react-router'
import { useLocalStorage } from 'usehooks-ts'

import { ChangedIcon } from '@/components/pokemon/changed-mark'
import { Button } from '@/components/ui/button'
import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

import { useSyncStatus } from '../hooks/use-sync-status'
import { changesSentence, recentChanges } from '../utils/recent-changes'

// The end of the latest sync whose banner was dismissed, kept in this browser only.
const DISMISSED_KEY = 'counterdex:sync-changes-dismissed'

/** The Pokédex's Changed view, of the Pokémon a sync changed in the last week. */
export const CHANGED_POKEMON_HREF = `${paths.pokedex.getHref()}?status=changed`

/**
 * Under the header, a strip saying what the latest sync changed, if it changed anything in the last
 * week, with a link to the changed Pokémon. Dismissing it hides it until a sync changes more.
 */
export function SyncChangesBanner() {
  const { data } = useSyncStatus()
  const [dismissed, setDismissed] = useLocalStorage<string | null>(DISMISSED_KEY, null)
  const run = recentChanges(data)
  if (!run || dismissed === run.finished_at) return null

  return (
    <aside aria-label={m.sync_changes_label()} className="border-b bg-muted/60">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-1.5 text-sm sm:px-6">
        <ChangedIcon className="size-4 text-muted-foreground" />
        <p className="min-w-0 flex-1">
          {changesSentence(run)}{' '}
          <Link
            to={CHANGED_POKEMON_HREF}
            className="rounded-sm font-semibold whitespace-nowrap underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {m.sync_changes_link()}
          </Link>
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={m.sync_changes_dismiss()}
          onClick={() => setDismissed(run.finished_at)}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </aside>
  )
}
