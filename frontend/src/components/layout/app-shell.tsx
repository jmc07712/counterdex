import { usePrevious, useScrollDirection, useWindowScroll } from '@mantine/hooks'
import {
  ArrowUpRight,
  BookOpenText,
  CircleUserRound,
  Compass,
  LayoutGrid,
  type LucideIcon,
  UsersRound,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, matchPath, Outlet, useLocation } from 'react-router'

import { paths } from '@/config/paths'
import { useCurrentUser } from '@/lib/auth'
import type { Message } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { AccountMenu } from './account-menu'
import { BrandMark } from './brand-mark'
import { ThemeSwitch } from './theme-switch'
import { Toaster } from './toaster'

type NavItem = {
  to: string
  label: Message
  icon: LucideIcon
  // The pages, as route patterns, that the item is the current section for.
  sections: string[]
}

const primaryNav: NavItem[] = [
  {
    to: paths.home.getHref(),
    label: m.nav_teams,
    icon: UsersRound,
    sections: [paths.home.path, paths.team.path],
  },
  {
    to: paths.explore.getHref(),
    label: m.nav_explore,
    icon: Compass,
    sections: [paths.explore.path],
  },
  {
    to: paths.pokedex.getHref(),
    label: m.nav_pokedex,
    icon: LayoutGrid,
    sections: [paths.pokedex.path],
  },
]

const SIGN_IN = { label: m.nav_sign_in, icon: CircleUserRound, sections: [paths.signIn.path] }

// Signing in leads back to the page it started from. On the sign-in and sign-up pages, it keeps
// their ?next=.
function useSignInNav(): NavItem {
  const { pathname, search } = useLocation()
  const onAuthPage = pathname === paths.signIn.path || pathname === paths.signUp.path
  const next = onAuthPage ? new URLSearchParams(search).get('next') : pathname + search
  return { ...SIGN_IN, to: paths.signIn.getHref(next ?? undefined) }
}

function useIsCurrent(item: NavItem) {
  const { pathname } = useLocation()
  return item.sections.some((section) => matchPath(section, pathname) !== null)
}

// The tab bar always shows within this many pixels of the top of the page, so the bounce at the
// top can't hide it.
const TAB_BAR_HIDES_AFTER = 56

// Served by the API, not this app.
const apiDocs = { href: '/api/docs', label: m.nav_api, icon: BookOpenText }

export function AppShell() {
  // The phone tab bar hides while scrolling down the page and comes back on any scroll up,
  // like the toolbars in mobile browsers.
  const scrollDirection = useScrollDirection()
  const [{ y: scrollY }] = useWindowScroll()
  const tabBarHidden = scrollDirection === 'down' && scrollY > TAB_BAR_HIDES_AFTER
  // Until the API says whether someone's signed in, neither Sign in nor the account shows.
  const { data: user, isPending } = useCurrentUser()
  const signInNav = useSignInNav()

  // Signing out removes the account menu, which had focus; it moves to the page rather than
  // being lost.
  const main = useRef<HTMLElement>(null)
  const previousUser = usePrevious(user)
  useEffect(() => {
    if (previousUser && user === null && document.activeElement === document.body) {
      main.current?.focus()
    }
  }, [previousUser, user])

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {m.nav_skip_to_content()}
      </a>

      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:px-6">
          <Link to={paths.home.getHref()} aria-label={m.nav_home()} className="rounded-md">
            <BrandMark />
          </Link>

          <nav aria-label={m.nav_primary()} className="hidden h-full items-stretch gap-6 md:flex">
            {primaryNav.map((item) => (
              <HeaderLink key={item.to} item={item} />
            ))}
            <a href={apiDocs.href} target="_blank" rel="noopener" className={headerLinkClass(false)}>
              {apiDocs.label()}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
              <NewTabNote />
            </a>
          </nav>

          <div className="ml-auto flex h-full items-center gap-4">
            <ThemeSwitch />
            <div className="hidden h-full items-stretch md:flex">
              {user ? (
                <AccountMenu user={user} className={headerLinkClass(false)}>
                  {user.username}
                </AccountMenu>
              ) : (
                !isPending && <HeaderLink item={signInNav} />
              )}
            </div>
          </div>
        </div>
      </header>

      <main
        id="main"
        ref={main}
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-28 outline-none sm:px-6 md:pb-16"
      >
        <Outlet />
      </main>

      <nav
        aria-label={m.nav_primary()}
        data-state={tabBarHidden ? 'hidden' : 'shown'}
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden',
          'transition-transform duration-200 ease-out motion-reduce:transition-none',
          // Tabbing into the hidden bar brings it back, so keyboard focus is never off screen.
          'data-[state=hidden]:not-has-focus-visible:translate-y-full',
        )}
      >
        <ul className="grid grid-cols-5">
          {primaryNav.map((item) => (
            <li key={item.to}>
              <TabLink item={item} />
            </li>
          ))}
          <li>
            {user ? (
              <AccountMenu user={user} side="top" className={cn(tabLinkClass(false), 'w-full')}>
                <CircleUserRound className="size-5" aria-hidden="true" />
                <span className="max-w-full truncate px-1">{user.username}</span>
              </AccountMenu>
            ) : (
              !isPending && <TabLink item={signInNav} />
            )}
          </li>
          <li>
            <a href={apiDocs.href} target="_blank" rel="noopener" className={tabLinkClass(false)}>
              <apiDocs.icon className="size-5" aria-hidden="true" />
              {apiDocs.label()}
              <NewTabNote />
            </a>
          </li>
        </ul>
      </nav>

      <Toaster />
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
      <span className="sr-only">{m.nav_opens_in_new_tab()}</span>
    </>
  )
}

function HeaderLink({ item }: { item: NavItem }) {
  const current = useIsCurrent(item)
  return (
    <Link
      to={item.to}
      aria-current={current ? 'page' : undefined}
      className={headerLinkClass(current)}
    >
      {item.label()}
    </Link>
  )
}

function TabLink({ item }: { item: NavItem }) {
  const current = useIsCurrent(item)
  const Icon = item.icon
  return (
    <Link to={item.to} aria-current={current ? 'page' : undefined} className={tabLinkClass(current)}>
      <Icon className="size-5" aria-hidden="true" />
      {item.label()}
    </Link>
  )
}
