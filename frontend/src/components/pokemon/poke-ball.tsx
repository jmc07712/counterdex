import type { ComponentProps } from 'react'

/** A Poké Ball's outline, for decoration, drawn in the text color. */
export function PokeBall(props: ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={7}
      {...props}
    >
      <circle cx="50" cy="50" r="44" />
      <path d="M6 50h30M64 50h30" />
      <circle cx="50" cy="50" r="14" />
    </svg>
  )
}
