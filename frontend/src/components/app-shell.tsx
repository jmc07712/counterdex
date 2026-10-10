import { CircleUserRound, LayoutGrid, type LucideIcon, UsersRound } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'

import { BrandMark } from '@/components/brand-mark'
import { cn } from '@/lib/utils'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const primaryNav: NavItem[] = [
  { to: '/', label: 'Pokédex', icon: LayoutGrid, end: true },
  { to: '/teams', label: 'Teams', icon: UsersRound },
]

const accountNav: NavItem = { to: '/sign-in', label: 'Sign in', icon: CircleUserRound }

export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:px-6">
          <NavLink to="/" aria-label="Counterdex home" className="rounded-md">
            <BrandMark />
          </NavLink>

          <nav aria-label="Primary" className="hidden h-full items-stretch gap-6 md:flex">
            {primaryNav.map((item) => (
              <HeaderLink key={item.to} item={item} />
            ))}
          </nav>

          <div className="ml-auto hidden h-full items-stretch md:flex">
            <HeaderLink item={accountNav} />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-28 sm:px-6 md:pb-16">
        <Outlet />
      </main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-3">
          {[...primaryNav, accountNav].map((item) => (
            <li key={item.to}>
              <TabLink item={item} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

function HeaderLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'inline-flex items-center border-b-2 pt-0.5 text-sm font-medium transition-colors',
          isActive
            ? 'border-brand text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground',
        )
      }
    >
      {item.label}
    </NavLink>
  )
}

function TabLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium',
          isActive
            ? 'text-foreground before:absolute before:top-0 before:h-0.5 before:w-10 before:rounded-full before:bg-brand'
            : 'text-muted-foreground',
        )
      }
    >
      <Icon className="size-5" aria-hidden="true" />
      {item.label}
    </NavLink>
  )
}
