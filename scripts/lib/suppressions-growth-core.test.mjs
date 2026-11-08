import { describe, expect, it } from 'vitest';

import {
  findChangedRules,
  findSuppressionGrowth,
  parseJsonWithComments
} from './suppressions-growth-core.mjs';

const base = {
  'src/a.ts': { 'max-depth': { count: 2 }, 'no-console': { count: 1 } }
};

describe('findSuppressionGrowth', () => {
  it('accepts an unchanged or shrinking baseline', () => {
    expect(findSuppressionGrowth(base, base)).toEqual([]);
    expect(findSuppressionGrowth(base, { 'src/a.ts': { 'max-depth': { count: 1 } } })).toEqual([]);
  });

  it('reports a frozen count that rose', () => {
    expect(
      findSuppressionGrowth(base, {
        'src/a.ts': { 'max-depth': { count: 3 }, 'no-console': { count: 1 } }
      })
    ).toEqual([{ file: 'src/a.ts', rule: 'max-depth', from: 2, to: 3 }]);
  });

  it('reports a frozen rule appearing in another file', () => {
    expect(
      findSuppressionGrowth(base, { ...base, 'src/b.ts': { 'no-console': { count: 1 } } })
    ).toEqual([{ file: 'src/b.ts', rule: 'no-console', from: 0, to: 1 }]);
  });

  it('accepts the findings of a rule switched on in the same change', () => {
    expect(
      findSuppressionGrowth(base, { ...base, 'src/b.ts': { 'max-params': { count: 4 } } })
    ).toEqual([]);
  });

  it('accepts growth of a rule whose configuration changed in the same change', () => {
    const head = { ...base, 'src/b.ts': { 'no-console': { count: 2 } } };
    expect(findSuppressionGrowth(base, head, new Set(['no-console']))).toEqual([]);
  });
});

describe('parseJsonWithComments', () => {
  it('drops comments and trailing commas outside strings only', () => {
    const text = '{\n  "a": "x // y, }", /* note */\n  "b": [1, 2,], // end\n}';
    expect(parseJsonWithComments(text)).toEqual({ a: 'x // y, }', b: [1, 2] });
  });
});

describe('findChangedRules', () => {
  const config = {
    overrides: [{ files: ['src/computing/**'], rules: { 'no-restricted-globals': ['error'] } }],
    rules: { 'max-depth': ['error', { max: 4 }], 'no-console': 'error' }
  };

  it('finds no change in an identical config', () => {
    expect(findChangedRules(config, config)).toEqual(new Set());
  });

  it('finds a rule with new options, a new override and a new rule', () => {
    const head = {
      overrides: [
        { files: ['src/computing/**'], rules: { 'no-restricted-globals': ['error', 'window'] } }
      ],
      rules: { 'max-depth': ['error', { max: 3 }], 'max-params': 'error', 'no-console': 'error' }
    };
    expect(findChangedRules(config, head)).toEqual(
      new Set(['max-depth', 'max-params', 'no-restricted-globals'])
    );
  });
});
