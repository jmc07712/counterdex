import { Toaster as Sonner } from 'sonner'

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      // Sonner switches to its full-width phone layout at 600px, but the phone tab bar shows up to
      // md, so both layouts take their distance from the bottom from --toaster-bottom: above the
      // tab bar below md, and sonner's default 24px from md up.
      offset={{ bottom: 'var(--toaster-bottom)' }}
      mobileOffset={{ bottom: 'var(--toaster-bottom)' }}
      className="[--toaster-bottom:calc(88px_+_env(safe-area-inset-bottom))] md:[--toaster-bottom:24px]"
      // sonner's own colors, from the app's theme tokens, so toasts follow light and dark mode;
      // the app's font rather than sonner's; and clicks, even while a modal dialog or sheet has
      // turned them off for the rest of the page.
      style={{
        '--normal-bg': 'var(--popover)',
        '--normal-text': 'var(--popover-foreground)',
        '--normal-border': 'var(--border)',
        fontFamily: 'inherit',
        pointerEvents: 'auto',
      }}
    />
  )
}
