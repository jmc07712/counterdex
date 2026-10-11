import { PokeBall } from '@/components/pokemon/poke-ball'
import { pokemonSpriteUrl } from '@/components/pokemon/sprites'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

// Pikachu, Charizard, Blastoise, Venusaur, Snorlax and Gengar.
const SAMPLE_TEAM = [25, 6, 9, 3, 143, 94]

export function PokedexPanel({ busy }: { busy: boolean }) {
  return (
    // The red is deepest at the top, behind the text, so the text keeps its contrast.
    <div className="relative isolate flex flex-col gap-4 overflow-hidden bg-linear-to-t from-brand to-brand-deep to-40% p-5 text-brand-foreground md:gap-8 md:p-8">
      <Lights busy={busy} />

      <div className="hidden md:block">
        <p className="font-heading text-4xl leading-none font-extrabold text-balance">
          {m.auth_panel_headline()}
        </p>
        <p className="mt-3 max-w-xs">{m.auth_panel_description()}</p>
      </div>

      <ul aria-hidden="true" className="grid grid-cols-6 gap-2 md:mt-auto md:grid-cols-3 md:gap-4">
        {SAMPLE_TEAM.map((pokemonId) => (
          <li
            key={pokemonId}
            className="grid aspect-square place-items-center rounded-full bg-brand-foreground/10 ring-1 ring-brand-foreground/25"
          >
            <img
              src={pokemonSpriteUrl(pokemonId)}
              alt=""
              width={96}
              height={96}
              className="size-full scale-110 object-contain drop-shadow-md [image-rendering:pixelated]"
            />
          </li>
        ))}
      </ul>

      <PokeBall className="absolute -top-20 -right-20 -z-10 hidden size-72 opacity-10 md:block" />
    </div>
  )
}

function Lights({ busy }: { busy: boolean }) {
  return (
    <svg viewBox="0 0 72 40" className="h-10 w-auto self-start md:h-13" aria-hidden="true">
      <circle cx="20" cy="20" r="19" className="fill-brand-foreground" />
      <circle cx="20" cy="20" r="14" className="fill-brand-deep" />
      <circle cx="15" cy="15" r="4" className="fill-brand-foreground/70" />
      <circle
        cx="50"
        cy="7"
        r="4.5"
        strokeWidth={1}
        className={cn('fill-led-yellow stroke-black/25', busy && 'motion-safe:animate-pulse')}
      />
      <circle cx="64" cy="7" r="4.5" strokeWidth={1} className="fill-led-green stroke-black/25" />
    </svg>
  )
}
