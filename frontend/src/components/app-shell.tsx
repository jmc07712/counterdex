import {
  ArrowUpRight,
  BookOpenText,
  CircleUserRound,
  LayoutGrid,
  type LucideIcon,
  UsersRound,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router'

import { BrandMark } from '@/components/brand-mark'
import { ThemeSwitch } from '@/components/theme-switch'
import { cn } from '@/lib/utils'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
}

const primaryNav: NavItem[] = [
  { to: '/', label: 'Pokédex', icon: LayoutGrid },
  { to: '/teams', label: 'Teams', icon: UsersRound },
]

const accountNav: NavItem = { to: '/sign-in', label: 'Sign in', icon: CircleUserRound }

// The API serves its own docs, outside this app: a plain link (not a router link) that opens
// them in a new tab, so the app keeps its place.
const apiDocs = { href: '/api/docs', label: 'API', icon: BookOpenText }

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
            <a href={apiDocs.href} target="_blank" rel="noopener" className={headerLinkClass(false)}>
              {apiDocs.label}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
              <NewTabNote />
            </a>
          </nav>

          <div className="ml-auto flex h-full items-center gap-4">
            <ThemeSwitch />
            <div className="hidden h-full items-stretch md:flex">
              <HeaderLink item={accountNav} />
            </div>
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
        <ul className="grid grid-cols-4">
          {[...primaryNav, accountNav].map((item) => (
            <li key={item.to}>
              <TabLink item={item} />
            </li>
          ))}
          <li>
            <a href={apiDocs.href} target="_blank" rel="noopener" className={tabLinkClass(false)}>
              <apiDocs.icon className="size-5" aria-hidden="true" />
              {apiDocs.label}
              <NewTabNote />
            </a>
          </li>
        </ul>
      </nav>
    </div>
  )
}

function headerLinkClass(isActive: boolean) {
  return cn(
    'inline-flex items-center gap-1 border-b-2 pt-0.5 text-sm font-medium transition-colors',
    isActive
      ? 'border-brand text-foreground'
      : 'border-transparent text-muted-foreground hover:text-foreground',
  )
}

function tabLinkClass(isActive: boolean) {
  return cn(
    'relative flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium',
    isActive
      ? 'text-foreground before:absolute before:top-0 before:h-0.5 before:w-10 before:rounded-full before:bg-brand'
      : 'text-muted-foreground',
  )
}

// The space sits outside the span: a span's own leading space is dropped from the link's name.
function NewTabNote() {
  return (
    <>
      {' '}
      <span className="sr-only">(opens in a new tab)</span>
    </>
  )
}

function HeaderLink({ item }: { item: NavItem }) {
  return (
    <NavLink to={item.to} className={({ isActive }) => headerLinkClass(isActive)}>
      {item.label}
    </NavLink>
  )
}

function TabLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink to={item.to} className={({ isActive }) => tabLinkClass(isActive)}>
      <Icon className="size-5" aria-hidden="true" />
      {item.label}
    </NavLink>
  )
}
