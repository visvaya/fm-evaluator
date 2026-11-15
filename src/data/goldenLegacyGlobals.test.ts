import { readFileSync } from 'node:fs';

import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

// Side-effect imports of the production bootstrap that the golden harness leaves out on purpose:
// they open storage or start the worker, which the goldens must not do.
const SKIPPED_BY_GOLDENS = new Set([
  '../parsing/workerParser',
  '../storage/db',
  '../storage/state'
]);

/** Module specifiers of the bare `import 'x'` statements of a source file, in order. */
const sideEffectImports = (relativePath: string): string[] => {
  const url = new URL(relativePath, import.meta.url);
  const { program } = parseSync(url.pathname, readFileSync(url, 'utf8'));
  return program.body.flatMap((statement) =>
    statement.type === 'ImportDeclaration' && statement.specifiers.length === 0
      ? [statement.source.value]
      : []
  );
};

describe('goldenLegacyGlobals', () => {
  it('registers the same legacy modules in the same order as the production bootstrap', () => {
    const production = sideEffectImports('../lib/legacyBootstrap.ts').filter(
      (specifier) => !SKIPPED_BY_GOLDENS.has(specifier)
    );

    expect(sideEffectImports('./goldenLegacyGlobals.ts')).toEqual(production);
  });
});
