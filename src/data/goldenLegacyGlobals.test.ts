import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

// Side-effect imports of the production bootstrap that the golden harness leaves out on purpose:
// they open storage or start the worker, which the goldens must not do.
const SKIPPED_BY_GOLDENS = new Set([
  '../parsing/workerParser',
  '../storage/db',
  '../storage/state'
]);

const sideEffectImports = (relativePath: string): string[] =>
  [
    ...readFileSync(new URL(relativePath, import.meta.url), 'utf8').matchAll(
      /^import '([^']+)';$/gm
    )
  ]
    .map((match) => match[1])
    .filter((specifier): specifier is string => specifier !== undefined);

describe('goldenLegacyGlobals', () => {
  it('registers the same legacy modules in the same order as the production bootstrap', () => {
    const production = sideEffectImports('../lib/legacyBootstrap.ts').filter(
      (specifier) => !SKIPPED_BY_GOLDENS.has(specifier)
    );

    expect(sideEffectImports('./goldenLegacyGlobals.ts')).toEqual(production);
  });
});
