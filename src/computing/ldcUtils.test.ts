import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ldcMappingState, ldcSettings } from '../config/ldcConfig';
import { clearPlayerRuntimeRows, setPlayerRuntimeRows } from '../lib/playerRuntimeCache';

import { identifyReserveTeamLeague } from './ldc';
import {
  autoMapLeague,
  calculateLeagueSimilarity,
  checkAmbiguousDuplicateNames,
  checkDuplicateNames,
  checkOrderConsistency,
  extractLeagueLevel,
  findLeaguesWithSameLDC,
  formatLdcRaw,
  formatMultiplier,
  getLeaguesHash,
  getOptimalLdcRawPrecision,
  getOptimalMultiplierPrecision,
  getPlayerDataHash,
  improvedLeagueMatching,
  isFreeAgent,
  isLeagueMatched,
  levenshteinDistance,
  normalizeLeagueNameForGrouping,
  normalizeRomanNumerals,
  suggestBasketFix,
  suggestOrderFix,
  validateLeague
} from './ldcUtils';

import type { ClubLeague, LeagueData } from '../config/ldcConfig';

function makeLeague(overrides: Partial<LeagueData> = {}): LeagueData {
  return {
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

describe('ldcUtils', () => {
  beforeEach(() => {
    ldcSettings.leagues = [];
    ldcSettings.enabled = true;
    ldcSettings.model = 'basket';
    vi.stubGlobal('loadLeagueMappings', () => ({}));
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      removeItem: vi.fn(),
      setItem: vi.fn()
    });
    clearPlayerRuntimeRows();
  });

  // -----------------------------------------------------------------------
  // Normalization
  // -----------------------------------------------------------------------

  describe('normalizeLeagueNameForGrouping', () => {
    it('should return empty string for empty input', () => {
      expect(normalizeLeagueNameForGrouping('')).toBe('');
    });

    it('should trim whitespace', () => {
      expect(normalizeLeagueNameForGrouping('  Premier League  ')).toBe('Premier League');
    });

    it('should strip group suffix', () => {
      expect(normalizeLeagueNameForGrouping('Liga X - grupa A')).toBe('Liga X');
      expect(normalizeLeagueNameForGrouping('Serie B - group 1')).toBe('Serie B');
    });

    it('should strip Polish region suffixes', () => {
      expect(normalizeLeagueNameForGrouping('III Liga - łódzka')).toBe('III Liga');
      expect(normalizeLeagueNameForGrouping('IV Liga - małopolska ABC')).toBe('IV Liga');
    });

    it('should strip Serie/Series suffix', () => {
      expect(normalizeLeagueNameForGrouping('Campeonato Série B')).toBe('Campeonato');
    });

    it('should map AF patterns to Divisões Regionais', () => {
      expect(normalizeLeagueNameForGrouping('AF Porto')).toBe('Divisões Regionais');
    });
  });

  describe('normalizeRomanNumerals', () => {
    it('should replace roman numerals with digits', () => {
      expect(normalizeRomanNumerals('Liga III')).toBe('Liga 3');
      expect(normalizeRomanNumerals('Division I')).toBe('Division 1');
    });

    it('should handle multiple roman numerals', () => {
      expect(normalizeRomanNumerals('I Liga vs II Liga')).toBe('1 Liga vs 2 Liga');
    });

    it('should match whole words of every mapped numeral in any case', () => {
      expect(normalizeRomanNumerals('iv V vi VII viii IX x Ii')).toBe('4 5 6 7 8 9 10 2');
      expect(normalizeRomanNumerals('XI XX Vista IIa')).toBe('XI XX Vista IIa');
    });

    it('should leave non-roman text unchanged', () => {
      expect(normalizeRomanNumerals('Premier League')).toBe('Premier League');
    });
  });

  describe('extractLeagueLevel', () => {
    it('should extract level from roman numeral + liga', () => {
      expect(extractLeagueLevel('III liga')).toBe(3);
      expect(extractLeagueLevel('V Liga')).toBe(5);
    });

    it('should extract level from numeric + liga', () => {
      expect(extractLeagueLevel('2 liga')).toBe(2);
    });

    it('should return null for no match', () => {
      expect(extractLeagueLevel('Premier League')).toBeNull();
    });
  });

  describe('autoMapLeague', () => {
    it('should return null for empty input', () => {
      expect(autoMapLeague('')).toBeNull();
    });

    it('should map AF pattern to Divisões Regionais', () => {
      expect(autoMapLeague('AF Porto')).toBe('Divisões Regionais');
    });

    it('should map Polish III/IV/V Liga with groups', () => {
      expect(autoMapLeague('Polska III Liga - grupa A')).toBe('Polska III Liga');
    });

    it('should return null when normalized equals original', () => {
      expect(autoMapLeague('Premier League')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Matching
  // -----------------------------------------------------------------------

  describe('calculateLeagueSimilarity', () => {
    it('should return 1.0 for identical normalized names', () => {
      expect(calculateLeagueSimilarity('Premier League', 'Premier League')).toBe(1);
    });

    it('should return 0.0 for different league levels', () => {
      expect(calculateLeagueSimilarity('III liga polska', 'IV liga polska')).toBe(0);
    });

    it('should return partial similarity for overlapping words', () => {
      const sim = calculateLeagueSimilarity('English Premier League', 'English Championship');
      expect(sim).toBeGreaterThan(0);
      expect(sim).toBeLessThan(1);
    });
  });

  describe('improvedLeagueMatching', () => {
    it('should match identical names with confidence 1.0', () => {
      const result = improvedLeagueMatching('Premier League', 'Premier League');
      expect(result.match).toBe(true);
      expect(result.confidence).toBe(1);
      expect(result.type).toBe('normalized');
    });

    it('should match roman numeral variants', () => {
      const result = improvedLeagueMatching('Liga III', 'Liga 3');
      expect(result.match).toBe(true);
      expect(result.type).toBe('normalized_roman');
    });

    it('should not match unrelated leagues', () => {
      const result = improvedLeagueMatching('Premier League', 'Serie A');
      expect(result.match).toBe(false);
      expect(result.type).toBe('none');
    });
  });

  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('abc', 'abc')).toBe(0);
    });

    it('should return string length for empty comparison', () => {
      expect(levenshteinDistance('abc', '')).toBe(3);
      expect(levenshteinDistance('', 'abc')).toBe(3);
    });

    it('should compute correct edit distance', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('sunday', 'saturday')).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  describe('checkOrderConsistency', () => {
    it('should return empty array for consistent ordering', () => {
      const leagues = [
        makeLeague({ multiplier: 1, name: 'A', rank: 1 }),
        makeLeague({ multiplier: 0.8, name: 'B', rank: 2 })
      ];
      expect(checkOrderConsistency(leagues)).toEqual([]);
    });

    it('should detect inconsistent ordering', () => {
      const leagues = [
        makeLeague({ multiplier: 0.5, name: 'A', rank: 1 }),
        makeLeague({ multiplier: 0.8, name: 'B', rank: 2 })
      ];
      const problems = checkOrderConsistency(leagues);
      expect(problems).toHaveLength(1);
      expect(problems[0].league1).toBe('A');
      expect(problems[0].league2).toBe('B');
    });

    it('rejects non-finite rank in league validation', () => {
      const league = makeLeague({ name: 'A', nation: 'X', rank: NaN });
      expect(validateLeague(league).some((error) => error.includes('Rank'))).toBe(true);
    });

    it('rejects non-finite stars in league validation', () => {
      const league = makeLeague({ name: 'A', nation: 'X', rank: 1, stars: NaN });
      expect(validateLeague(league).some((error) => error.includes('Gwiazdki'))).toBe(true);
    });

    it('detects order inversions regardless of array order', () => {
      const leagues = [
        makeLeague({ multiplier: 0.9, name: 'Rank2', nation: 'Y', rank: 2 }),
        makeLeague({ multiplier: 0.5, name: 'Rank1', nation: 'X', rank: 1 })
      ];
      const problems = checkOrderConsistency(leagues);
      expect(problems).toHaveLength(1);
      expect(problems[0].league1).toBe('Rank1');
      expect(problems[0].league1Index).toBe(1);
      expect(problems[0].league2Index).toBe(0);
    });

    it('should return empty for single league', () => {
      expect(checkOrderConsistency([makeLeague()])).toEqual([]);
    });
  });

  describe('suggestOrderFix', () => {
    it('should suggest swapping leagues', () => {
      const l1 = makeLeague({ name: 'A', stars: 3 });
      const l2 = makeLeague({ name: 'B', stars: 2 });
      const suggestion = suggestOrderFix(l1, l2);
      expect(suggestion).toContain('Zamień miejscami');
    });

    it('should suggest changing stars when equal', () => {
      const l1 = makeLeague({ name: 'A', stars: 3 });
      const l2 = makeLeague({ name: 'B', stars: 3 });
      const suggestion = suggestOrderFix(l1, l2);
      expect(suggestion).toContain('Zmień gwiazdki');
    });
  });

  describe('suggestBasketFix', () => {
    it('should suggest based on different stars', () => {
      const leagues = [makeLeague({ stars: 3 }), makeLeague({ stars: 2 })];
      const suggestions = suggestBasketFix(leagues);
      expect(suggestions[0]).toContain('gwiazdki');
    });

    it('should give default suggestions when no clear issue', () => {
      const leagues = [
        makeLeague({ name: 'A', rank: 1, stars: 3 }),
        makeLeague({ name: 'B', rank: 2, stars: 3 })
      ];
      const suggestions = suggestBasketFix(leagues);
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('suggests rank changes (not stars) when model is simple', () => {
      ldcSettings.model = 'simple';
      const leagues = [
        makeLeague({ name: 'A', nation: 'X', rank: 1, stars: null }),
        makeLeague({ name: 'B', nation: 'Y', rank: 2, stars: null })
      ];
      const suggestions = suggestBasketFix(leagues);
      expect(suggestions.join(' ')).not.toMatch(/gwiazdk/i);
      expect(suggestions.join(' ')).toMatch(/rank|kolejno/i);
    });
  });

  describe('findLeaguesWithSameLDC', () => {
    it('should return empty when no duplicates', () => {
      ldcSettings.leagues = [
        makeLeague({ ldcRaw: 1, name: 'A' }),
        makeLeague({ ldcRaw: 0.5, name: 'B' })
      ];
      expect(findLeaguesWithSameLDC()).toEqual([]);
    });

    it('should detect leagues with same ldcRaw', () => {
      ldcSettings.leagues = [
        makeLeague({ ldcRaw: 0.5, name: 'A' }),
        makeLeague({ ldcRaw: 0.5, name: 'B' })
      ];
      const problems = findLeaguesWithSameLDC();
      expect(problems).toHaveLength(1);
      expect(problems[0].leagues).toHaveLength(2);
    });

    it('does not report distinct sub-1e-8 values as duplicates', () => {
      ldcSettings.leagues = [
        makeLeague({ ldcRaw: 1e-10, name: 'A', nation: 'X' }),
        makeLeague({ ldcRaw: 2e-10, name: 'B', nation: 'Y' })
      ];
      expect(findLeaguesWithSameLDC()).toEqual([]);
    });
  });

  describe('validateLeague', () => {
    it('should return empty for valid league', () => {
      ldcSettings.leagues = [makeLeague({ name: 'Unique', rank: 1, stars: 3 })];
      const errors = validateLeague(makeLeague({ name: 'Another', rank: 1, stars: 3 }));
      expect(errors).toEqual([]);
    });

    it('should detect duplicate name and nation pairs', () => {
      ldcSettings.leagues = [makeLeague({ name: 'Dup', nation: 'ENG' })];
      const errors = validateLeague(makeLeague({ name: 'Dup', nation: 'ENG' }));
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Duplikat');
    });

    it('should allow duplicate names when nations differ', () => {
      ldcSettings.leagues = [makeLeague({ name: 'Dup', nation: 'ENG' })];
      const errors = validateLeague(makeLeague({ name: 'Dup', nation: 'POL' }));
      expect(errors.some((error) => error.includes('Duplikat'))).toBe(false);
    });

    it('should warn when same name exists but current row has no nation', () => {
      ldcSettings.leagues = [makeLeague({ name: 'Dup', nation: 'ENG' })];
      const errors = validateLeague(makeLeague({ name: 'Dup', nation: '' }));
      expect(errors).toContain('Powielona nazwa ligi bez przypisanego kraju');
    });

    it('should detect invalid stars', () => {
      const errors = validateLeague(makeLeague({ name: 'X', stars: 10 }));
      expect(errors.some((e) => e.includes('Gwiazdki'))).toBe(true);
    });

    it('should reject stars below 0.5', () => {
      const errors = validateLeague(makeLeague({ name: 'X', stars: 0 }));
      expect(errors.some((error) => error.includes('0.5-5'))).toBe(true);
    });

    it('should accept 0.5 stars', () => {
      const errors = validateLeague(makeLeague({ name: 'X', stars: 0.5 }));
      expect(errors.some((error) => error.includes('Gwiazdki'))).toBe(false);
    });

    it('should detect invalid rank', () => {
      const errors = validateLeague(makeLeague({ name: 'X', rank: 0 }));
      expect(errors.some((e) => e.includes('Rank'))).toBe(true);
    });

    it('should not treat imported source mappings as conflicts when target league exists', () => {
      vi.stubGlobal('loadLeagueMappings', () => ({
        'AF Aveiro Campeonato Sabseg': 'Divisões Regionais',
        'AF Algarve 1ª Divisão': 'Divisões Regionais'
      }));
      ldcSettings.leagues = [makeLeague({ name: 'Divisões Regionais', nation: 'Portugalia' })];

      const errors = validateLeague(
        makeLeague({ name: 'Divisões Regionais', nation: 'Portugalia' })
      );

      expect(errors.some((error) => error.includes('Konflikt w mapowaniach'))).toBe(false);
    });
  });

  describe('checkDuplicateNames', () => {
    it('should find duplicates case-insensitively', () => {
      ldcSettings.leagues = [
        makeLeague({ name: 'Premier League', nation: 'ENG' }),
        makeLeague({ name: 'premier league', nation: 'eng' })
      ];
      expect(checkDuplicateNames('Premier League', 'ENG')).toHaveLength(2);
    });

    it('should exclude specified index', () => {
      ldcSettings.leagues = [makeLeague({ name: 'Premier League', nation: 'ENG' })];
      expect(checkDuplicateNames('Premier League', 'ENG', 0)).toHaveLength(0);
    });

    it('should not treat same names from different nations as duplicates', () => {
      ldcSettings.leagues = [
        makeLeague({ name: 'Premier League', nation: 'ENG' }),
        makeLeague({ name: 'Premier League', nation: 'EGY' })
      ];
      expect(checkDuplicateNames('Premier League', 'POL')).toHaveLength(0);
      expect(checkDuplicateNames('Premier League', 'ENG', 1)).toHaveLength(1);
    });

    it('detects a duplicate across nation aliases (FM code vs Polish exonym)', () => {
      ldcSettings.leagues = [
        makeLeague({ name: 'Premier League', nation: 'ENG' }),
        makeLeague({ name: 'Premier League', nation: 'Anglia' })
      ];
      expect(checkDuplicateNames('Premier League', 'England')).toHaveLength(2);
    });
  });

  describe('checkAmbiguousDuplicateNames', () => {
    it('should detect ambiguous duplicates when current row has no nation', () => {
      ldcSettings.leagues = [
        makeLeague({ name: 'Premier League', nation: 'ENG' }),
        makeLeague({ name: 'Premier League', nation: '' })
      ];
      expect(checkAmbiguousDuplicateNames('Premier League', '')).toHaveLength(2);
    });

    it('should ignore rows with same name when current row has nation', () => {
      ldcSettings.leagues = [
        makeLeague({ name: 'Premier League', nation: 'ENG' }),
        makeLeague({ name: 'Premier League', nation: '' })
      ];
      expect(checkAmbiguousDuplicateNames('Premier League', 'ENG')).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Reserve Detection
  // -----------------------------------------------------------------------

  describe('identifyReserveTeamLeague', () => {
    it('should return null for single league', () => {
      const leagues: ClubLeague[] = [{ country: 'ENG', league: 'Premier League', multiplier: 1 }];
      expect(identifyReserveTeamLeague('Test FC', leagues)).toBeNull();
    });

    it('should identify lower multiplier league as reserve', () => {
      const leagues: ClubLeague[] = [
        { country: 'ENG', league: 'Reserve League', multiplier: 0.3 },
        { country: 'ENG', league: 'Premier League', multiplier: 1 }
      ];
      expect(identifyReserveTeamLeague('Test FC', leagues)).toBe('Reserve League');
    });

    it('should return null when multipliers are close', () => {
      const leagues: ClubLeague[] = [
        { country: 'ENG', league: 'League A', multiplier: 0.9 },
        { country: 'ENG', league: 'League B', multiplier: 1 }
      ];
      expect(identifyReserveTeamLeague('Test FC', leagues)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Formatting
  // -----------------------------------------------------------------------

  describe('getOptimalLdcRawPrecision', () => {
    it('should return 3 for empty input', () => {
      expect(getOptimalLdcRawPrecision([])).toBe(3);
    });

    it('should return 1 for large differences', () => {
      const leagues = [{ ldcRaw: 1 }, { ldcRaw: 2 }];
      expect(getOptimalLdcRawPrecision(leagues)).toBe(1);
    });

    it('should increase precision for small differences', () => {
      const leagues = [{ ldcRaw: 0.001 }, { ldcRaw: 0.002 }];
      expect(getOptimalLdcRawPrecision(leagues)).toBe(3);
    });

    it('should return high precision for very small differences', () => {
      const leagues = [{ ldcRaw: 0.0000001 }, { ldcRaw: 0.0000002 }];
      expect(getOptimalLdcRawPrecision(leagues)).toBe(7);
    });
  });

  describe('getOptimalMultiplierPrecision', () => {
    it('should return 3 for empty input', () => {
      expect(getOptimalMultiplierPrecision([])).toBe(3);
    });

    it('should handle single league', () => {
      expect(getOptimalMultiplierPrecision([{ multiplier: 1 }])).toBe(3);
    });
  });

  describe('formatLdcRaw', () => {
    it('should format with given precision', () => {
      expect(formatLdcRaw(1.23456, 2)).toBe('1.23');
      expect(formatLdcRaw(0.5, 4)).toBe('0.5000');
    });

    it('should return default for NaN', () => {
      expect(formatLdcRaw(NaN, 3)).toBe('0.000');
    });
  });

  describe('formatMultiplier', () => {
    it('should format with given precision', () => {
      expect(formatMultiplier(1, 3)).toBe('1.000');
      expect(formatMultiplier(0.12345, 4)).toBe('0.1235');
    });

    it('should return default for NaN', () => {
      expect(formatMultiplier(NaN, 3)).toBe('0.000');
    });
  });

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  describe('isFreeAgent', () => {
    it('should return true for empty/short/dash', () => {
      expect(isFreeAgent('')).toBe(true);
      expect(isFreeAgent('-')).toBe(true);
      expect(isFreeAgent('- ')).toBe(true);
      expect(isFreeAgent('AB')).toBe(true);
    });

    it('should return false for valid division', () => {
      expect(isFreeAgent('Premier League')).toBe(false);
      expect(isFreeAgent('Serie A')).toBe(false);
    });
  });

  describe('getLeaguesHash', () => {
    it('should produce stable hash from leagues', () => {
      const leagues = [
        makeLeague({ name: 'A' }),
        makeLeague({ name: 'B' }),
        makeLeague({ name: 'C' })
      ];
      expect(getLeaguesHash(leagues)).toBe(getLeaguesHash(structuredClone(leagues)));
    });

    it('should handle empty array', () => {
      expect(getLeaguesHash([])).toBe('0');
    });

    it('changes when a league in the middle changes', () => {
      const leagues = [
        makeLeague({ name: 'A' }),
        makeLeague({ name: 'B' }),
        makeLeague({ name: 'C' })
      ];
      const changedLeagues = structuredClone(leagues);
      changedLeagues[1].nation = 'Inny kraj';

      expect(getLeaguesHash(changedLeagues)).not.toBe(getLeaguesHash(leagues));
    });
  });

  describe('player runtime seam', () => {
    it('builds the player data hash from the shared runtime rows', () => {
      setPlayerRuntimeRows([
        { Division: 'Premier League', uid: '1' },
        { Division: 'Championship', uid: '2' }
      ]);

      const initialHash = getPlayerDataHash();
      setPlayerRuntimeRows([
        { Division: 'Premier League', uid: '1' },
        { Division: 'League One', uid: '2' }
      ]);

      expect(getPlayerDataHash()).not.toBe(initialHash);
    });

    it('detects matched leagues from the shared runtime rows', () => {
      setPlayerRuntimeRows([{ Division: 'Ekstraklasa', uid: '10' }]);

      expect(isLeagueMatched('Ekstraklasa')).toBe(true);
      expect(isLeagueMatched('Premier League')).toBe(false);
    });

    it('resolves a nation-scoped mapping only through Based In, never through Nation', () => {
      // A country-scoped mapping keyed on 'Brazylia' must not apply to a
      // player whose Based In is unknown, even if their Nation happens to
      // match that key - Nation is nationality, not league country.
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(() =>
          JSON.stringify({
            ['Liga TestowaBrazylia']: { name: 'Serie A', nation: 'Brazylia' }
          })
        ),
        removeItem: vi.fn(),
        setItem: vi.fn()
      });
      ldcMappingState.cache = null;

      setPlayerRuntimeRows([{ Division: 'Liga Testowa', Nation: 'Brazylia', uid: '20' }]);

      expect(isLeagueMatched('Serie A')).toBe(false);
    });

    it('ignores Nation when hashing player identities', () => {
      setPlayerRuntimeRows([{ Division: 'Premier League', Nation: 'Brazylia', uid: '1' }]);
      const withNation = getPlayerDataHash();

      setPlayerRuntimeRows([{ Division: 'Premier League', Nation: 'Argentyna', uid: '1' }]);
      const differentNation = getPlayerDataHash();

      expect(differentNation).toBe(withNation);
    });
  });
});
