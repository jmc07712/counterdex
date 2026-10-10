import 'react'

// Lets components set CSS custom properties (style={{ '--type-1': color }}) with type-checking.
declare module 'react' {
  interface CSSProperties {
    [variable: `--${string}`]: string | number | undefined
  }
}
