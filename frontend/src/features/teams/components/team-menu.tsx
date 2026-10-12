import { Ellipsis, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import type { Team } from '@/api'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

import { useDeleteTeam } from '../hooks/use-delete-team'
import { toastTeamProblem } from '../utils/team-change-error'

export function TeamMenu({ team }: { team: Team }) {
  const [confirming, setConfirming] = useState(false)
  const remove = useDeleteTeam(team)
  const navigate = useNavigate()
  const menuButton = useRef<HTMLButtonElement>(null)

  function handleDelete() {
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success(m.team_deleted({ name: team.name }))
        void navigate(paths.home.getHref({ scope: 'mine' }))
      },
      onError: toastTeamProblem,
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button ref={menuButton} variant="ghost" size="icon" aria-label={m.team_actions()}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            <Trash2 aria-hidden="true" />
            {m.team_delete()}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent
          // The menu item that opened the dialog is gone by now, so focus goes back to the menu's
          // button rather than to the page.
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            menuButton.current?.focus()
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{m.team_delete_title({ name: team.name })}</AlertDialogTitle>
            <AlertDialogDescription>{m.team_delete_description()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.team_delete_cancel()}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={handleDelete}
            >
              {m.team_delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
