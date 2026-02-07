import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['spec/**/*.spec.ts'],
    globals: true,
    setupFiles: ['./spec/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts']
    }
  }
})
