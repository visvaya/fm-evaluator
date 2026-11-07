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
        // Floors just below the values measured on 2026-09-30 (statements 55.05,
        // branches 51.35, functions 53.52, lines 56.01). Raise them, never lower.
        thresholds: { branches: 50, functions: 52, lines: 55, statements: 54 }
      },
      globals: true,
      include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.test.mjs'],
      pool: 'threads',
      // Node 25+ defines its own localStorage, which hides the one jsdom provides.
      execArgv: ['--no-experimental-webstorage']
    }
  })
);
