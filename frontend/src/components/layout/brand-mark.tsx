import { m } from '@/paraglide/messages.js'

/**
 * The Counterdex wordmark. The mark borrows the Pokédex's lens and indicator
 * lights rather than any trademarked artwork.
 */
export function BrandMark() {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 32 20" className="h-5 w-8" aria-hidden="true">
        <circle cx="10" cy="10" r="9" className="fill-brand" />
        <circle cx="7" cy="7" r="2.5" className="fill-white/55" />
        <circle cx="24" cy="4" r="2" className="fill-led-yellow" />
        <circle cx="30" cy="4" r="2" className="fill-led-green" />
      </svg>
      <span className="font-heading text-lg font-bold tracking-tight">{m.brand_name()}</span>
    </span>
  )
}
