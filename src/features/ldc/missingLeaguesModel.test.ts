import { describe, expect, it } from 'vitest';

import {
  buildMissingLeagueCandidates,
  buildMissingLeagueRecheckSummary,
  groupMissingLeagueCandidates
} from './missingLeaguesModel';

const deps = {
  autoMapLeague: (originalName: string) =>
    originalName === 'Regional League' ? 'Liga Test' : null,
  fuzzyMatchLeague: () => null,
  improvedLeagueMatching: (originalName: string, candidateName: string) => ({
    confidence:
      originalName === 'Improved Match League' && candidateName === 'Liga Improved' ? 0.82 : 0,
    match: originalName === 'Improved Match League' && candidateName === 'Liga Improved',
    type: 'improved'
  }),
  isFreeAgent: (division: string) => division === 'Free Agent',
  mapCountryCode: (countryCode: string) => {
    if (countryCode === 'POL') {
      return 'Polska';
    }

    if (countryCode === 'ENG') {
      return 'Anglia';
    }

    if (countryCode === 'EGY') {
      return 'Egipt';
    }

    return '';
  },
  normalizeLeagueNameForGrouping: (value: string) => {
    const normalizedValue = value.trim();
    const parts = normalizedValue.split(' ');
    const tail = parts.at(-1);

    if (tail && /^\d+$/.test(tail)) {
      return parts.slice(0, -1).join(' ');
    }

    return normalizedValue;
  }
};

describe('missingLeaguesModel', () => {
  it('detects missing leagues without mapped and free-agent entries', () => {
    const result = buildMissingLeagueCandidates(
      [
        { 'Based In': 'POL', Division: 'Regional League' },
        { 'Based In': 'POL', Division: 'Mapped League' },
        { 'Based In': 'ENG', Division: 'Free Agent' },
        { 'Based In': 'POL', Division: 'Improved Match League' }
      ],
      [
        { name: 'Liga Test', nation: 'Polska', rank: 2, stars: 4 },
        { name: 'Liga Improved', nation: 'Polska', rank: 7, stars: 3 }
      ],
      // Runtime only honors nation-scoped mapping keys for nation-scoped sources.
      { ['Mapped LeaguePolska']: { name: 'Liga Test', nation: 'Polska' } },
      deps,
      true
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      matchType: 'auto-mapped',
      name: 'Regional League',
      suggestedMatch: { name: 'Liga Test' }
    });
    expect(result[1]).toMatchObject({
      matchType: 'improved',
      name: 'Improved Match League',
      suggestedMatch: { name: 'Liga Improved' }
    });
  });

  it('keeps same-name player leagues from different nations separate', () => {
    const result = buildMissingLeagueCandidates(
      [
        { 'Based In': 'ENG', Division: 'Premier League' },
        { 'Based In': 'EGY', Division: 'Premier League' }
      ],
      [{ name: 'Premier League', nation: 'Anglia', rank: 1, stars: 5 }],
      {},
      deps,
      true
    );

    expect(result).toEqual([expect.objectContaining({ name: 'Premier League', nation: 'Egipt' })]);
  });

  it('uses a country-aware source mapping without hiding the same name from another nation', () => {
    const result = buildMissingLeagueCandidates(
      [
        { 'Based In': 'ENG', Division: 'National League' },
        { 'Based In': 'EGY', Division: 'National League' }
      ],
      [
        { name: 'English Target', nation: 'Anglia', rank: 1, stars: 5 },
        { name: 'Egyptian Target', nation: 'Egipt', rank: 2, stars: 4 }
      ],
      {
        ['National League\u001FAnglia']: { name: 'English Target', nation: 'Anglia' }
      },
      deps,
      true
    );

    expect(result).toEqual([expect.objectContaining({ name: 'National League', nation: 'Egipt' })]);
  });

  it('does not suggest an ambiguous same-name league for a nation-less source', () => {
    const result = buildMissingLeagueCandidates(
      [{ Division: 'Premier League 2' }],
      [
        { name: 'Premier League', nation: 'Anglia', rank: 1, stars: 5 },
        { name: 'Premier League', nation: 'Egipt', rank: 9, stars: 2 }
      ],
      {},
      deps,
      true
    );

    expect(result).toHaveLength(1);
    expect(result[0].suggestedMatch).toBeNull();
  });

  it('does not suggest a same-name league from another country', () => {
    const result = buildMissingLeagueCandidates(
      [{ 'Based In': 'EGY', Division: 'Premier League 2' }],
      [{ name: 'Premier League', nation: 'Anglia', rank: 1, stars: 5 }],
      {},
      deps,
      true
    );

    expect(result).toHaveLength(1);
    expect(result[0].nation).toBe('Egipt');
    expect(result[0].suggestedMatch).toBeNull();
  });

  it('ignores a nation-less mapping key for a nation-scoped source', () => {
    const result = buildMissingLeagueCandidates(
      [{ 'Based In': 'POL', Division: 'Legacy League' }],
      [{ name: 'Liga Test', nation: 'Polska', rank: 2, stars: 4 }],
      { 'Legacy League': 'Liga Test' },
      deps,
      true
    );

    expect(result).toEqual([expect.objectContaining({ name: 'Legacy League', nation: 'Polska' })]);
  });

  it('keeps a league visible when its mapping points at a removed target', () => {
    const result = buildMissingLeagueCandidates(
      [{ 'Based In': 'POL', Division: 'Orphaned League' }],
      [{ name: 'Liga Test', nation: 'Polska', rank: 2, stars: 4 }],
      { ['Orphaned LeaguePolska']: { name: 'Deleted League', nation: 'Polska' } },
      deps,
      true
    );

    expect(result).toEqual([
      expect.objectContaining({ name: 'Orphaned League', nation: 'Polska' })
    ]);
  });

  it('accepts fuzzy matches by distance below 0.3 and reports similarity confidence', () => {
    const fuzzyDeps = {
      ...deps,
      fuzzyMatchLeague: (
        _original: string,
        _normalized: string,
        country: string,
        leagues: { name: string; nation?: string; rank: number; stars: null | number }[]
      ) => {
        const league = leagues.find((candidate) => candidate.nation === country);
        return league ? { league, score: 0.1 } : null;
      }
    };

    const result = buildMissingLeagueCandidates(
      [{ 'Based In': 'POL', Division: 'Fuzzy Source' }],
      [{ name: 'Liga Fuzzy', nation: 'Polska', rank: 3, stars: 3 }],
      {},
      fuzzyDeps,
      true
    );

    expect(result[0].matchType).toBe('fuzzy');
    expect(result[0].suggestedMatch).toMatchObject({ name: 'Liga Fuzzy' });
    expect(result[0].matchScore).toBeCloseTo(0.9, 5);
  });

  it('rejects fuzzy matches with distance above the 0.3 threshold', () => {
    const fuzzyDeps = {
      ...deps,
      fuzzyMatchLeague: (
        _original: string,
        _normalized: string,
        country: string,
        leagues: { name: string; nation?: string; rank: number; stars: null | number }[]
      ) => {
        const league = leagues.find((candidate) => candidate.nation === country);
        return league ? { league, score: 0.5 } : null;
      }
    };

    const result = buildMissingLeagueCandidates(
      [{ 'Based In': 'POL', Division: 'Fuzzy Source' }],
      [{ name: 'Liga Fuzzy', nation: 'Polska', rank: 3, stars: 3 }],
      {},
      fuzzyDeps,
      true
    );

    expect(result[0].suggestedMatch).toBeNull();
    expect(result[0].matchType).toBe('none');
  });

  it('groups missing leagues by country and keeps Inne at the end', () => {
    const result = groupMissingLeagueCandidates(
      [
        {
          countryCode: 'POL',
          matchScore: null,
          matchType: 'none',
          name: 'Liga Regionalna 1',
          nation: 'Polska',
          normalized: 'Liga Regionalna',
          suggestedMatch: null,
          suggestedRank: 3,
          suggestedStars: 2.5
        },
        {
          countryCode: 'POL',
          matchScore: null,
          matchType: 'none',
          name: 'Liga Regionalna 2',
          nation: 'Polska',
          normalized: 'Liga Regionalna',
          suggestedMatch: null,
          suggestedRank: 4,
          suggestedStars: 2.5
        },
        {
          countryCode: 'XXX',
          matchScore: null,
          matchType: 'none',
          name: 'Unknown League',
          nation: '',
          normalized: 'Unknown League',
          suggestedMatch: null,
          suggestedRank: 9,
          suggestedStars: null
        }
      ],
      deps.normalizeLeagueNameForGrouping
    );

    expect(result.map((group) => group.country)).toEqual(['Polska', 'Inne']);
    expect(result[0].subGroups[0]).toMatchObject({
      displayName: 'Liga Regionalna',
      leagues: [{ name: 'Liga Regionalna 1' }, { name: 'Liga Regionalna 2' }]
    });
    expect(result[1].subGroups.at(-1)?.displayName).toBe('Inne');
  });

  it('builds recheck summaries for unchanged and improved states', () => {
    const previous = [
      {
        countryCode: 'POL',
        matchScore: null,
        matchType: 'none',
        name: 'League A',
        nation: 'Polska',
        normalized: 'League A',
        suggestedMatch: null,
        suggestedRank: 1,
        suggestedStars: null
      },
      {
        countryCode: 'POL',
        matchScore: null,
        matchType: 'none',
        name: 'League B',
        nation: 'Polska',
        normalized: 'League B',
        suggestedMatch: null,
        suggestedRank: 2,
        suggestedStars: null
      }
    ];

    expect(buildMissingLeagueRecheckSummary(previous, previous)).toMatchObject({
      message: 'Brak zmian - nadal 2 brakujących lig',
      tone: 'neutral'
    });
    expect(buildMissingLeagueRecheckSummary(previous, previous.slice(0, 1))).toMatchObject({
      message: 'Zmniejszono liczbę brakujących lig z 2 do 1 (usunięto: League B)',
      tone: 'positive'
    });
  });
});
