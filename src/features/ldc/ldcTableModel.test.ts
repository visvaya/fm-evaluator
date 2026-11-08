import { beforeEach, describe, expect, it } from 'vitest';

import {
  type LDCSettings,
  type LeagueData,
  ldcMappingState,
  ldcSettings
} from '@/config/ldcConfig';
import { clearPlayerRuntimeRows, setPlayerRuntimeRows } from '@/lib/playerRuntimeCache';

import { buildLdcLeagueRows } from './ldcTableModel';

function makeLeague(overrides: Partial<LeagueData> = {}): LeagueData {
  return {
    id: `league-${overrides.rank ?? 1}`,
    inputScore: 0,
    ldcRaw: 0,
    multiplier: 1,
    name: 'Test League',
    nation: 'Test',
    rank: 1,
    stars: 3,
    ...overrides
  };
}

function makeSettings(leagues: LeagueData[]): LDCSettings {
  return {
    alphaBasket: 1.7,
    alphaSimple: 5.3,
    baseLeague: leagues[0]?.name ?? 'Premier League',
    enabled: true,
    groupBy: null,
    leagues,
    model: 'basket',
    sortColumn: 'rank',
    sortDirection: 'asc'
  };
}

function buildRows(settings: LDCSettings) {
  ldcSettings.leagues = settings.leagues;
  return buildLdcLeagueRows(settings, '', 'all', true);
}

describe('ldcTableModel', () => {
  beforeEach(() => {
    ldcMappingState.cache = {};
    clearPlayerRuntimeRows();
  });

  it('validates a large league list quickly and still flags duplicates', () => {
    const leagues = Array.from({ length: 5000 }, (_, index) =>
      makeLeague({ id: `league-${index}`, name: `League ${index % 2500}`, rank: index + 1 })
    );
    const started = performance.now();

    const rows = buildRows(makeSettings(leagues));

    expect(performance.now() - started).toBeLessThan(1000);
    expect(
      rows.every((row) => row.validationErrors.some((error) => error.includes('Duplikat')))
    ).toBe(true);
  });

  it('preserves non-zero multiplier precision for very small values', () => {
    const rows = buildRows(
      makeSettings([
        makeLeague({ ldcRaw: 1, multiplier: 1, name: 'Premier League', rank: 1, stars: 5 }),
        makeLeague({
          ldcRaw: 0.00042,
          multiplier: 0.00042,
          name: 'Regional League',
          rank: 2,
          stars: 0.5
        })
      ])
    );

    expect(rows[1]?.multiplierText).not.toBe('0.000');
    expect(rows[1]?.multiplierText).toContain('0.000');
  });

  it('does not flag duplicate-name errors when same league name exists in another nation', () => {
    const rows = buildRows(
      makeSettings([
        makeLeague({ id: 'league-1', name: 'Premier League', nation: 'ENG', rank: 1 }),
        makeLeague({ id: 'league-2', name: 'Premier League', nation: 'EGY', rank: 2 })
      ])
    );

    expect(rows[0]?.validationErrors).toEqual([]);
    expect(rows[1]?.validationErrors).toEqual([]);
  });

  it('flags ambiguous duplicate names when one of the same-name leagues has no nation', () => {
    const rows = buildRows(
      makeSettings([
        makeLeague({ id: 'league-1', name: 'Premier League', nation: 'ENG', rank: 1 }),
        makeLeague({ id: 'league-2', name: 'Premier League', nation: '', rank: 2 })
      ])
    );

    expect(rows[1]?.validationErrors).toContain('Powielona nazwa ligi bez przypisanego kraju');
  });

  it('filters mapped leagues by target name and nation instead of name alone', () => {
    const settings = makeSettings([
      makeLeague({ id: 'league-1', name: 'Premier League', nation: 'Anglia', rank: 1 }),
      makeLeague({ id: 'league-2', name: 'Premier League', nation: 'Egipt', rank: 2 })
    ]);
    ldcSettings.leagues = settings.leagues;
    ldcMappingState.cache = {
      Source: { name: 'Premier League', nation: 'Anglia' }
    };

    const rows = buildLdcLeagueRows(settings, '', 'with-mappings', true);

    expect(rows.map((row) => row.league.nation)).toEqual(['Anglia']);
  });

  it('marks only the country-specific mapping target as matched', () => {
    const settings = makeSettings([
      makeLeague({ id: 'league-1', name: 'Premier League', nation: 'Anglia', rank: 1 }),
      makeLeague({ id: 'league-2', name: 'Premier League', nation: 'Egipt', rank: 2 })
    ]);
    ldcSettings.leagues = settings.leagues;
    ldcMappingState.cache = {
      ['Source League\u001FAnglia']: { name: 'Premier League', nation: 'Anglia' }
    };
    setPlayerRuntimeRows([{ 'Based In': 'ENG', Division: 'Source League' }]);

    const rows = buildLdcLeagueRows(settings, '', 'all', true);

    expect(rows.map((row) => ({ matched: row.isMatched, nation: row.league.nation }))).toEqual([
      { matched: true, nation: 'Anglia' },
      { matched: false, nation: 'Egipt' }
    ]);
  });
});
