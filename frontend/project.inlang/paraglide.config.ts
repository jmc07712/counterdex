import { defineConfig } from '@inlang/paraglide-js'

// Read by both the Vite plugin and `paraglide-js compile`, so they build the same output.
export default defineConfig({
  outdir: './src/paraglide',
  // One language for now, so there's no locale to detect.
  strategy: ['baseLocale'],
  emitTsDeclarations: true,
})
