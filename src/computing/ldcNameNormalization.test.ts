import { describe, expect, it } from 'vitest';

import { IMPORT_LIMITS } from '@/config/importLimits';

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
