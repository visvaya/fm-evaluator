// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { buildLdcIssueGroups, detectTieringConflicts } from './ldcIssues';
import {
  alignRankToStars,
  alignStarsToRank,
  repairDuplicateLdcLeagues,
  repairOrderConflict,
  repairTieringConflicts
} from './ldcRepairs';

import type { LeagueData } from '@/config/ldcConfig';

function makeLeague(overrides: Partial<LeagueData>): LeagueData {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    inputScore: overrides.inputScore ?? 100,
    ldcRaw: overrides.ldcRaw ?? 1,
    multiplier: overrides.multiplier ?? 1,
    name: overrides.name ?? 'League',
    nation: overrides.nation ?? 'ENG',
    rank: overrides.rank ?? 1,
    stars: overrides.stars ?? 5
  };
}

describe('ldcIssues', () => {
  it('detects tiering conflicts when a lower-ranked league has more stars', () => {
    const problems = detectTieringConflicts([
      makeLeague({ id: 'league-1', name: 'Top League', rank: 1, stars: 3 }),
      makeLeague({ id: 'league-2', name: 'Lower League', rank: 2, stars: 5 })
    ]);

    expect(problems).toHaveLength(1);
    expect(problems[0]?.lowerLeagueId).toBe('league-2');
  });

  it('merges order and tiering inconsistencies for the same pair into one consistency group', () => {
    const settings = {
      alphaBasket: 1.7,
      alphaSimple: 5.3,
      baseLeague: 'Top League',
      enabled: false,
      groupBy: null,
      leagues: [
        makeLeague({ id: 'league-1', name: 'Top League', rank: 1, stars: 3 }),
        makeLeague({ id: 'league-2', name: 'Lower League', rank: 2, stars: 5 })
      ],
      model: 'basket' as const,
      sortColumn: 'rank' as const,
      sortDirection: 'asc' as const
    };

    const groups = buildLdcIssueGroups(
      settings,
      [
        {
          ldcRaw: 0.5,
          leagues: settings.leagues,
          suggestions: ['Rozważ zmianę gwiazdek']
        }
      ],
      [
        {
          league1: 'Top League',
          league1Index: 0,
          league1Multiplier: 0.8,
          league1Rank: 1,
          league2: 'Lower League',
          league2Index: 1,
          league2Multiplier: 1,
          league2Rank: 2,
          suggestion: 'Zamień miejscami ligi'
        }
      ]
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.id).toBe('consistency-conflict');
  });

  it('uses row identity rather than a duplicate league name for order conflicts', () => {
    const settings = {
      alphaBasket: 1.7,
      alphaSimple: 5.3,
      baseLeague: 'Premier League',
      enabled: false,
      groupBy: null,
      leagues: [
        makeLeague({ id: 'england', name: 'Premier League', nation: 'Anglia', rank: 1 }),
        makeLeague({ id: 'egypt', name: 'Premier League', nation: 'Egipt', rank: 2 })
      ],
      model: 'basket' as const,
      sortColumn: 'rank' as const,
      sortDirection: 'asc' as const
    };

    const groups = buildLdcIssueGroups(
      settings,
      [],
      [
        {
          league1: 'Premier League',
          league1Index: 0,
          league1Multiplier: 0.8,
          league1Rank: 1,
          league2: 'Premier League',
          league2Index: 1,
          league2Multiplier: 1,
          league2Rank: 2,
          suggestion: 'Zamień miejscami ligi'
        }
      ]
    );

    expect(
      groups.find((group) => group.id === 'consistency-conflict')?.issues[0]?.affectedLeagueIds
    ).toEqual(['egypt', 'england']);
  });
});

describe('ldcRepairs', () => {
  it('aligns stars to rank using descending tier buckets', () => {
    const leagues = alignStarsToRank([
      makeLeague({ rank: 1, stars: 2 }),
      makeLeague({ rank: 2, stars: 2 }),
      makeLeague({ rank: 3, stars: 2 })
    ]);

    expect(leagues.map((league) => league.stars)).toEqual([5, 4.5, 4]);
  });

  it('aligns rank to stars while keeping star order descending', () => {
    const leagues = alignRankToStars([
      makeLeague({ id: 'league-1', name: 'Low', rank: 1, stars: 1 }),
      makeLeague({ id: 'league-2', name: 'High', rank: 2, stars: 5 })
    ]);

    expect(leagues[0]?.name).toBe('High');
    expect(leagues[0]?.rank).toBe(1);
  });

  it('repairs tiering conflicts by clamping lower leagues to previous stars', () => {
    const leagues = repairTieringConflicts([
      makeLeague({ rank: 1, stars: 3 }),
      makeLeague({ rank: 2, stars: 5 })
    ]);

    expect(leagues[1]?.stars).toBe(3);
  });

  it('repairs duplicate LDC conflicts by lowering later conflicting stars', () => {
    const leagues = repairDuplicateLdcLeagues(
      [
        makeLeague({ id: 'league-1', rank: 1, stars: 2 }),
        makeLeague({ id: 'league-2', rank: 2, stars: 2 })
      ],
      ['league-1', 'league-2']
    );

    expect(leagues[1]?.stars).toBe(1.5);
  });

  it('repairs order conflicts by swapping the conflicting league order', () => {
    const leagues = repairOrderConflict(
      [
        makeLeague({ id: 'league-1', name: 'A', rank: 1, stars: 5 }),
        makeLeague({ id: 'league-2', name: 'B', rank: 2, stars: 5 })
      ],
      ['league-1', 'league-2']
    );

    expect(leagues[0]?.id).toBe('league-2');
    expect(leagues[1]?.rank).toBe(2);
  });
});
