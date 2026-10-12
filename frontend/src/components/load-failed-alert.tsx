import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { m } from '@/paraglide/messages.js'

type LoadFailedAlertProps = { title: string; onRetry: () => void }

/** Says something didn't load, with a button to ask for it again. */
export function LoadFailedAlert({ title, onRetry }: LoadFailedAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{m.common_check_connection()}</AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {m.common_try_again()}
        </Button>
      </AlertAction>
    </Alert>
  )
}
