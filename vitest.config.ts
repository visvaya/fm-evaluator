import { mergeConfig } from 'vite';
import { defineConfig } from 'vitest/config';

// @ts-expect-error Vitest native config loading resolves the TS file directly.
import { createSharedViteConfig } from './vite.shared.ts';

export default defineConfig(
  mergeConfig(createSharedViteConfig(), {
    test: {
      environment: 'node',
      exclude: ['e2e/**'],
      coverage: {
        exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/*.d.ts'],
        include: ['src/**/*.{ts,tsx,js}'],
        provider: 'v8',
        reporter: ['text-summary', 'json-summary'],
        // Floors one point below the values measured on 2026-11-08, rounded down: the whole
        // tree (statements 58.53, branches 54.04, functions 57.16, lines 59.59) and each logic
        // directory (UI directories are covered by component and browser tests instead).
        // src/cache branches varied between 78.7 and 80.3 across runs, so its floor is 77.
        // Raise them with tests, never lower them.
        thresholds: {
          branches: 53,
          functions: 56,
          lines: 58,
          statements: 57,
          'src/cache/**': { branches: 77, functions: 93, lines: 91, statements: 90 },
          'src/computing/**': { branches: 71, functions: 91, lines: 82, statements: 79 },
          'src/config/**': { branches: 83, functions: 78, lines: 89, statements: 89 },
          'src/data/**': { branches: 69, functions: 75, lines: 77, statements: 76 },
          'src/export/**': { branches: 81, functions: 93, lines: 80, statements: 80 },
          'src/mapping/**': { branches: 58, functions: 67, lines: 68, statements: 68 },
          'src/parsing/**': { branches: 84, functions: 83, lines: 88, statements: 87 },
          'src/processing/**': { branches: 92, functions: 99, lines: 97, statements: 95 },
          'src/schema/**': { branches: 91, functions: 99, lines: 97, statements: 97 },
          'src/storage/**': { branches: 54, functions: 61, lines: 63, statements: 59 },
          'src/store/**': { branches: 49, functions: 72, lines: 75, statements: 73 },
          'src/utils/**': { branches: 75, functions: 91, lines: 86, statements: 83 },
          'src/workerBridge/**': { branches: 70, functions: 76, lines: 78, statements: 77 },
          'src/workers/**': { branches: 87, functions: 82, lines: 86, statements: 86 }
        }
      },
      globals: true,
      include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.test.mjs'],
      pool: 'threads',
      // Node 25+ defines its own localStorage, which hides the one jsdom provides.
      execArgv: ['--no-experimental-webstorage']
    }
  })
);
