import { describe, expect, it } from 'vitest';

import { lintInDirectory } from './plugin-test-support.mjs';

// One violation of each layer rule. A directory dropped from the override, or a rule that stops
// applying after an oxlint upgrade, leaves the finding out and fails the test.
const FIXTURE = `import { createRoot } from 'react-dom/client';
export const leak = () => [createRoot, window.innerWidth, Date.now()];
`;

const LOGIC_DIRS = [
  'src/computing',
  'src/parsing',
  'src/processing',
  'src/mapping',
  'src/schema',
  'src/data'
];

const RULES = [
  'eslint(no-restricted-imports)',
  'eslint(no-restricted-globals)',
  'eslint(no-restricted-properties)'
];

// The layer rules reported for the fixture placed in `dir`, from one oxlint run.
const layerRulesIn = (dir) => {
  const codes = new Set(lintInDirectory(FIXTURE, dir).map((diagnostic) => diagnostic.code));
  return RULES.filter((rule) => codes.has(rule));
};

describe('layer boundary overrides', () => {
  it.each(LOGIC_DIRS)('apply the layer rules in %s', { timeout: 60_000 }, (dir) => {
    expect(layerRulesIn(dir)).toEqual(RULES);
  });

  it('do not apply outside the logic layers', { timeout: 60_000 }, () => {
    expect(layerRulesIn('src/components')).toEqual([]);
  });
});
