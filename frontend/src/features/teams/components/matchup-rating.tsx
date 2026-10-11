import type { Matchup, Pokemon, Rating } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { matchupSentence, multiplierWords } from '../utils/matchup-sentence'

// Each rating's status light.
const LIGHTS: Record<Rating, string> = {
  good: 'bg-led-green',
  even: 'bg-led-yellow',
  bad: 'bg-destructive',
}

// Each rating's tint, behind its words.
const TINTS: Record<Rating, string> = {
  good: 'bg-led-green/15',
  even: 'bg-muted',
  bad: 'bg-destructive/10',
}

/** A matchup's rating as a status light and a word, so it doesn't rest on color alone. */
export function RatingMark({ rating }: { rating: Rating }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold">
      <span
        aria-hidden="true"
        className={cn('size-2.5 shrink-0 rounded-full ring-1 ring-foreground/25', LIGHTS[rating])}
      />
      {m.team_matchup_rating({ rating })}
    </span>
  )
}

/** A matchup's rating and its attack's multiplier, on its rating's tint: "Good · 4×". */
export function RatingChip({ matchup }: { matchup: Matchup }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-sm',
        TINTS[matchup.rating],
      )}
    >
      <RatingMark rating={matchup.rating} />{' '}
      <span className="tabular-nums">{multiplierWords(matchup.attack.multiplier)}</span>
    </span>
  )
}

type MatchupButtonProps = { pokemon: Pokemon; opponent: Pokemon; matchup: Matchup }

/**
 * `pokemon`'s matchup against `opponent` as a button, on its rating's tint: its rating, and its
 * attack's multiplier below. It opens a popover with the matchup in a sentence.
 */
export function MatchupButton({ pokemon, opponent, matchup }: MatchupButtonProps) {
  const names = { pokemon: displayName(pokemon.name), opponent: displayName(opponent.name) }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-sm transition-[filter] outline-none hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:ring-2 data-[state=open]:ring-foreground/40 dark:hover:brightness-125',
            TINTS[matchup.rating],
          )}
        >
          <span className="sr-only">{m.team_matchup_cell(names)}</span>{' '}
          <RatingMark rating={matchup.rating} />{' '}
          <span className="text-xs text-muted-foreground tabular-nums">
            {multiplierWords(matchup.attack.multiplier)}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        aria-label={m.team_matchup_title(names)}
        className="w-72 text-sm leading-relaxed"
      >
        {matchupSentence(pokemon, opponent, matchup)}
      </PopoverContent>
    </Popover>
  )
}
