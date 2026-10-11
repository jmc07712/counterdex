import { Toaster as Sonner } from 'sonner'

export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      // Above the phone tab bar.
      offset={{ bottom: 88 }}
      mobileOffset={{ bottom: 88 }}
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
