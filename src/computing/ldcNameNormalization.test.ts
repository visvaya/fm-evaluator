import { describe, expect, it } from 'vitest';

import { IMPORT_LIMITS } from '@/config/importLimits';

import { seededStrings } from '../utils/seededStrings';

import { normalizeLeagueNameForGrouping } from './ldcNameNormalization';

const SLOW_INPUT_BUDGET_MS = 1000;

describe('normalizeLeagueNameForGrouping', () => {
  it('strips group and region suffixes', () => {
    expect(normalizeLeagueNameForGrouping('III Liga - Grupa 1')).toBe('III Liga');
    expect(normalizeLeagueNameForGrouping('IV Liga (łódzka)')).toBe('IV Liga');
  });

  it('only collapses whitespace in a name longer than the limit', () => {
    const name = `${'x'.repeat(IMPORT_LIMITS.leagueNameLengthChars)}  -  Grupa 1`;

    expect(normalizeLeagueNameForGrouping(name)).toBe(
      `${'x'.repeat(IMPORT_LIMITS.leagueNameLengthChars)} - Grupa 1`
    );
  });

  it('handles a long name of unclosed group words quickly', () => {
    const name = '(group '.repeat(20_000);
    const started = performance.now();

    normalizeLeagueNameForGrouping(name);

    expect(performance.now() - started).toBeLessThan(SLOW_INPUT_BUDGET_MS);
  });

  it('handles a long whitespace run quickly', () => {
    const started = performance.now();

    normalizeLeagueNameForGrouping(`A${' '.repeat(100_000)}!`);

    expect(performance.now() - started).toBeLessThan(SLOW_INPUT_BUDGET_MS);
  });
});

// The patterns above now start a leading whitespace run only where one starts, written
// `(?:(?<!\s)\s+)?` for `\s*` and `(?<!\s)\s+` for `\s+`. Each pair below keeps a pattern's
// shape (with a shorter word list) in its former and its current form.
/* oxlint-disable regexp/no-super-linear-move -- the former forms are the reference */
const ANCHORED_PAIRS: readonly (readonly [RegExp, RegExp])[] = [
  [/\s*-\s*AF\s[A-Z\s]+/i, /(?:(?<!\s)\s+)?-\s*AF\s[A-Z\s]+/i],
  [/\s*-\s*(grupa|zona)\s*[0-9A-Z].*$/i, /(?:(?<!\s)\s+)?-\s*(grupa|zona)\s*[0-9A-Z].*$/i],
  [/\s+(Serie|Series)\s+[A-Z0-9]+$/i, /(?<!\s)\s+(Serie|Series)\s+[A-Z0-9]+$/i],
  [/\s*\([^)]*(grupa|zona)[^)]*\)/gi, /(?:(?<!\s)\s+)?\([^)]*(grupa|zona)[^)]*\)/gi]
];
/* oxlint-enable regexp/no-super-linear-move */

describe('anchored leading whitespace in the normalization patterns', () => {
  it('removes the same text as the former forms', () => {
    const words = ['-', ' ', '  ', 'AF', 'B', 'grupa', 'zona', '1', 'Serie', '(', ')', 'x'];
    const texts = seededStrings({ alphabet: words, count: 20_000, maxLength: 10, seed: 7 });
    const differences = ANCHORED_PAIRS.flatMap(([former, current]) =>
      texts.filter((text) => text.replace(former, '') !== text.replace(current, ''))
    );
    expect(differences).toEqual([]);
  });
});
