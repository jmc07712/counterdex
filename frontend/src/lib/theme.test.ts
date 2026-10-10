import { describe, expect, it } from 'vitest'

import indexHtml from '../../index.html?raw'
import { THEME_STORAGE_KEY } from './theme'

describe('theme storage key', () => {
  it('matches the no-flash script in index.html', () => {
    // index.html can't import TypeScript, so the key is duplicated there; keep them in sync.
    expect(indexHtml).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`)
  })
})
