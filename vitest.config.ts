import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    include: ['tests/**/*.test.tsx', 'tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    globals: false,
    clearMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, 'src'),
      '@payload-config': path.resolve(dirname, 'src/payload.config.ts'),
    },
  },
})
