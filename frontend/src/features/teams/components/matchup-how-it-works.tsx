import { useId } from 'react'

import { Disclosure } from '@/components/disclosure'
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
    <Disclosure summary={m.matchup_how_title()}>
      <div className="mt-3 grid gap-4 rounded-xl border bg-card p-4 text-sm @2xl:grid-cols-2">
        <HowItWorksList part={choosing} />
        <HowItWorksList part={scoring} />
      </div>
    </Disclosure>
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
