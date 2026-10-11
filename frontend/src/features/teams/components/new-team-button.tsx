import { Plus } from 'lucide-react'
import { useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

import { useCreateTeam } from '../hooks/use-create-team'
import { teamProblem } from '../utils/team-change-error'

export function NewTeamButton({ teamCount }: { teamCount: number }) {
  const create = useCreateTeam()
  const navigate = useNavigate()
  // Set by the first click, at once: isPending changes only once the button renders again, which
  // can be after a second click. A second click would make a second team, with its own id.
  const creating = useRef(false)

  function handleClick() {
    if (creating.current) return
    creating.current = true
    create.mutate(
      { id: crypto.randomUUID(), name: m.team_default_name({ number: teamCount + 1 }) },
      {
        onSuccess: (team) => void navigate(paths.teamEdit.getHref(team.id)),
        onError: (error) => {
          creating.current = false
          toast.error(m.team_problem({ problem: teamProblem(error) }))
        },
      },
    )
  }

  return (
    <Button onClick={handleClick} disabled={create.isPending}>
      <Plus aria-hidden="true" />
      {create.isPending ? m.teams_creating() : m.teams_new()}
    </Button>
  )
}
