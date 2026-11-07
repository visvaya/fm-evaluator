import { describe, expect, it } from 'vitest';

import { convertLeaguesForModel } from './ldcModelConversion';

import type { LeagueData } from '@/config/ldcConfig';

function makeLeague(overrides: Partial<LeagueData>): LeagueData {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    inputScore: 0,
    ldcRaw: 0,
    multiplier: 1,
    name: overrides.name ?? 'League',
    nation: overrides.nation ?? 'Country',
    rank: overrides.rank ?? 1,
    stars: overrides.stars ?? null
  };
}

describe('convertLeaguesForModel', () => {
  it('preserves league identity and fills only missing stars for the basket model', () => {
    const leagues = [
      makeLeague({ id: 'one', name: 'One', rank: 1, stars: 4 }),
      makeLeague({ id: 'two', name: 'Two', rank: 2, stars: null }),
      makeLeague({ id: 'three', name: 'Three', rank: 3, stars: null })
    ];

    const converted = convertLeaguesForModel(leagues, 'basket');

    expect(converted.map(({ id, name, rank }) => ({ id, name, rank }))).toEqual(
      leagues.map(({ id, name, rank }) => ({ id, name, rank }))
    );
    expect(converted.map((league) => league.stars)).toEqual([4, 4.5, 4]);
    expect(converted).not.toBe(leagues);
  });

  it('keeps stars in storage when switching to the simple model', () => {
    const leagues = [makeLeague({ rank: 1, stars: 3.5 })];

    expect(convertLeaguesForModel(leagues, 'simple')[0]?.stars).toBe(3.5);
  });
});
