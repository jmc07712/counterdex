import { type FormEvent, useState } from 'react'

import { m } from '@/paraglide/messages.js'

// As the API allows: 1 to 40 characters once spaces at either end are trimmed.
const MAX_NAME_LENGTH = 40

type TeamNameFieldProps = { name: string; onRename: (name: string) => void }

/** The team's name as the page's heading, edited in place; saved on Enter or leaving it. */
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
      <h1 className="text-3xl font-bold sm:text-4xl">
        <input
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
          // The heading's own type; a hint of a field on hover, and a ring while editing.
          className="-mx-2 w-[calc(100%+1rem)] rounded-lg bg-transparent px-2 py-0.5 outline-none hover:bg-muted/60 focus-visible:bg-transparent focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </h1>
    </form>
  )
}
