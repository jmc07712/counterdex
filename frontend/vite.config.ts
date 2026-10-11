import path from 'node:path'

import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // Paraglide compiles messages/ into src/paraglide, with options from its config in project.inlang.
  plugins: [react(), tailwindcss(), paraglideVitePlugin({ project: './project.inlang' })],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // `vercel dev` serves the whole app on :3000 and runs this server on a random port behind it.
    // Sending /api there too means the app also works when opened on this server's own port.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
  },
})
