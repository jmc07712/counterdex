import type { ReactNode } from 'react'

import type { Challenger, Matchup, TeamMember } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { cn } from '@/lib/utils'

import { asMember } from '../utils/as-member'
import { matchupAgainst } from '../utils/matchups'
import { MemberThumb } from './member-thumb'

type MatchupGridProps = {
  // Above the grid, saying what it shows. It names the grid too.
  caption: string
  // What the rows are, heading their column for a screen reader.
  rowsName: string
  rows: Challenger[]
  // The team's members, in battle order.
  members: TeamMember[]
  // Beside a row's thumb: its name, and anything under it.
  rowHeader: (row: Challenger) => ReactNode
  // A row's matchup against a member, in the member's column.
  cell: (row: Challenger, member: TeamMember, matchup: Matchup) => ReactNode
  className?: string
}

/**
 * Pokémon matched up against a team: a column for each of the team's members, in battle order, and
 * a row for each Pokémon, in the order given, with a cell for its matchup against each member.
 */
export function MatchupGrid({
  caption,
  rowsName,
  rows,
  members,
  rowHeader,
  cell,
  className,
}: MatchupGridProps) {
  return (
    <table className={cn('w-full table-fixed border-separate border-spacing-1.5', className)}>
      <caption className="mb-1 caption-top px-1.5 text-left text-sm text-muted-foreground">
        {caption}
      </caption>
      <thead>
        <tr>
          <th scope="col" className="w-40 @4xl:w-52">
            <span className="sr-only">{rowsName}</span>
          </th>
          {members.map((member) => (
            <th key={member.pokemon.id} scope="col" className="px-1 align-bottom">
              <span className="flex flex-col items-center gap-1">
                <MemberThumb member={member} className="size-12" />
                <span className="text-xs leading-tight font-semibold break-words">
                  {displayName(member.pokemon.name)}
                </span>
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, position) => (
          <tr key={row.pokemon.id}>
            <th scope="row" className="text-left font-normal">
              <span className="flex items-center gap-2">
                <MemberThumb member={asMember(row.pokemon, position)} className="size-10" />
                {rowHeader(row)}
              </span>
            </th>
            {members.map((member) => {
              const matchup = matchupAgainst(row, member.pokemon.id)
              return <td key={member.pokemon.id}>{matchup && cell(row, member, matchup)}</td>
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
