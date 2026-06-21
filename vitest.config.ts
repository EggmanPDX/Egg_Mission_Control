import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 60,
      },
    },
  },
  resolve: {
    alias: {
      electron: new URL('./test/__mocks__/electron.ts', import.meta.url).pathname,
    },
  },
})
