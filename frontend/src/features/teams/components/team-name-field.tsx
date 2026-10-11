import { type FormEvent, useState } from 'react'

import { Input } from '@/components/ui/input'
import { m } from '@/paraglide/messages.js'

// As the API allows: 1 to 40 characters once spaces at either end are trimmed.
const MAX_NAME_LENGTH = 40

type TeamNameFieldProps = { name: string; onRename: (name: string) => void }

/** The team's name, edited in place; saved on Enter or leaving the field. */
export function TeamNameField({ name, onRename }: TeamNameFieldProps) {
  const [draft, setDraft] = useState(name)
  const [editing, setEditing] = useState(false)
  // Follows the saved name unless it's being edited.
  const shown = editing ? draft : name

  function save() {
    setEditing(false)
    const trimmed = draft.trim()
    // A blank name goes back to the one it had.
    if (trimmed === '' || trimmed === name) return
    onRename(trimmed)
  }

  // Enter leaves the field, which saves the name.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = event.currentTarget.elements.namedItem('name')
    if (input instanceof HTMLInputElement) input.blur()
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 flex-1">
      <Input
        name="name"
        aria-label={m.team_name_label()}
        value={shown}
        maxLength={MAX_NAME_LENGTH}
        onFocus={() => {
          setDraft(name)
          setEditing(true)
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        className="h-auto border-transparent bg-transparent px-1 font-heading text-3xl font-bold shadow-none hover:border-input focus-visible:border-input sm:text-4xl dark:bg-transparent"
      />
    </form>
  )
}
