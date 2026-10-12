import { ChevronDown } from 'lucide-react'
import { useId } from 'react'

import { m } from '@/paraglide/messages.js'

/** A part of how a matchup section works: a heading, and a point per line under it. */
export type HowItWorksPart = { title: string; points: string[] }

/**
 * Folded away under a matchup section's description: how the section chooses its Pokémon, then how
 * each matchup is scored, which every section shares (the API's `scoring.py` and `constants.py`).
 */
export function MatchupHowItWorks({ choosing }: { choosing: HowItWorksPart }) {
  const scoring = {
    title: m.matchup_how_scoring_title(),
    points: [
      m.matchup_how_types(),
      m.matchup_how_stats(),
      m.matchup_how_speed(),
      m.matchup_how_ratings(),
    ],
  }
  return (
    <details className="group/how">
      <summary className="-mx-1 flex w-fit cursor-pointer list-none items-center gap-1 rounded-md px-1 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        {m.matchup_how_title()}
        <ChevronDown
          aria-hidden="true"
          className="size-4 transition-transform group-open/how:rotate-180"
        />
      </summary>
      <div className="mt-3 grid gap-4 rounded-xl border bg-card p-4 text-sm @2xl:grid-cols-2">
        <HowItWorksList part={choosing} />
        <HowItWorksList part={scoring} />
      </div>
    </details>
  )
}

function HowItWorksList({ part }: { part: HowItWorksPart }) {
  const headingId = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <h3 id={headingId} className="font-semibold">
        {part.title}
      </h3>
      <ul
        aria-labelledby={headingId}
        className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground"
      >
        {part.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </div>
  )
}
