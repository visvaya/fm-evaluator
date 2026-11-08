import { RuleTester } from 'oxlint/plugins-dev';
import { describe, expect, it } from 'vitest';

import commentsPlugin from './comments-plugin.mjs';
import { configureRuleTester, lintWithProjectConfig } from './plugin-test-support.mjs';

const WIRING_FIXTURE = `// Liczymy średnią
const label = 'Średnia'; // English comment
/* Wynik końcowy */
export { label };
`;

describe('comments plugin wiring', () => {
  it('reports through the project config', { timeout: 60_000 }, () => {
    const lines = lintWithProjectConfig(WIRING_FIXTURE, 'comments(english-only)').map(
      (diagnostic) => diagnostic.labels[0]?.span.line
    );
    expect(lines).toEqual([1, 3]);
  });
});

configureRuleTester();

const ts = (code) => ({ code, filename: 'probe.ts' });
const invalid = (code) => ({ ...ts(code), errors: [{ messageId: 'polish' }] });

new RuleTester().run('english-only', commentsPlugin.rules['english-only'], {
  valid: [
    ts('// Average of the last five matches\nconst a = 1;'),
    ts("const label = 'Średnia'; // Polish only in the string"),
    ts('/* Price in € */ const price = 1;')
  ],
  invalid: [
    invalid('// Średnia z meczów\nconst a = 1;'),
    invalid('/** Zwraca średnią */\nfunction f() { return 1; }'),
    invalid('const a = 1; /* ŁĄCZNIE */')
  ]
});
