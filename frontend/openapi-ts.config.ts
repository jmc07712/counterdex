import { defineConfig } from '@hey-api/openapi-ts'

// Generates the typed API client in src/api (types, fetch functions and TanStack Query
// options) from openapi.json, which the backend exports. Regenerate both with
// `npm run api:generate` after changing the API.
export default defineConfig({
  input: 'openapi.json',
  output: 'src/api',
  plugins: [
    // Requests stay relative (/api/...): the API is served from the same origin as the app.
    { name: '@hey-api/client-fetch', baseUrl: false },
    '@hey-api/sdk',
    { name: '@tanstack/react-query', infiniteQueryOptions: true },
  ],
})
