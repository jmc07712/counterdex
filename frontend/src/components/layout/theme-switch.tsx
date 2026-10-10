import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useId, useState } from 'react'

import {
  applyPreference,
  getSavedPreference,
  savePreference,
  SYSTEM_DARK_QUERY,
  type ThemePreference,
} from '@/lib/theme'

const options = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const

/** A three-position slider (Light · System · Dark) built on native radio buttons. */
export function ThemeSwitch() {
  const name = useId()
  const [preference, setPreference] = useState<ThemePreference>(getSavedPreference)

  useEffect(() => {
    applyPreference(preference)
    if (preference !== 'system') return

    const media = matchMedia(SYSTEM_DARK_QUERY)
    const followSystem = () => applyPreference('system')
    media.addEventListener('change', followSystem)
    return () => media.removeEventListener('change', followSystem)
  }, [preference])

  const selectedIndex = options.findIndex((option) => option.value === preference)

  return (
    <fieldset className="relative grid grid-cols-3 rounded-full border bg-muted p-0.5">
      <legend className="sr-only">Theme</legend>
      <span
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0.5 w-[calc((100%-0.25rem)/3)] rounded-full bg-background shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(${selectedIndex * 100}%)` }}
      />
      {options.map(({ value, label, icon: Icon }) => (
        <label
          key={value}
          title={label}
          className="relative flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground has-checked:text-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring"
        >
          <input
            type="radio"
            name={name}
            value={value}
            checked={preference === value}
            onChange={() => {
              savePreference(value)
              setPreference(value)
            }}
            className="sr-only"
          />
          <Icon className="size-3.5" aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </label>
      ))}
    </fieldset>
  )
}
