// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ldcCache, ldcMappingState, ldcSettings } from '../config/ldcConfig';
import { clearPlayerRuntimeRows, setPlayerRuntimeRows } from '../lib/playerRuntimeCache';

import {
  addLeagueMapping,
  applyLDCToStats,
  calculateBasketInputScore,
  calculateSimpleInputScore,
  computeLDC,
  filterPlayersByLDC,
  findClubLeagues,
  getLDCForLeague,
  getLDCForLeagueRaw,
  getLDCTooltip,
  getPlayerLeagueMultiplier,
  loadLeagueMappings,
  parseLDCCSV,
  removeLeagueMapping,
  restoreOriginalStats,
  saveLeagueMappings
} from './ldc';
import { getMappingTarget, resolveMappingTargetLeague } from './ldcMappings';

import type { LeagueData } from '../config/ldcConfig';

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

describe('ldc', () => {
  beforeEach(() => {
    ldcSettings.enabled = true;
    ldcSettings.model = 'simple';
    ldcSettings.alphaBasket = 1.7;
    ldcSettings.alphaSimple = 5.3;
    ldcSettings.baseLeague = 'Premier League';
    ldcSettings.baseLeagueNation = '';
    ldcSettings.leagues = [];
    ldcCache.clear();
    ldcMappingState.cache = null;
    ldcMappingState.initPromise = null;
    clearPlayerRuntimeRows();

    // Mock localStorage
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] || null),
      removeItem: vi.fn((key: string) => {
        // eslint-disable-next-line fp/no-delete -- localStorage mock mirrors the real mutable API
        delete store[key];
      }),
      setItem: vi.fn((key: string, val: string) => {
        store[key] = val;
      })
    });
    vi.stubGlobal('ldcStorage', null);
    vi.stubGlobal('addAudit', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // -----------------------------------------------------------------------
  // Core Computation
  // -----------------------------------------------------------------------

  describe('calculateSimpleInputScore', () => {
    it('should assign linear scores based on rank', () => {
      const leagues = [
        makeLeague({ name: 'A', rank: 1 }),
        makeLeague({ name: 'B', rank: 2 }),
        makeLeague({ name: 'C', rank: 3 })
      ];
      calculateSimpleInputScore(leagues);

      expect(leagues[0].inputScore).toBe(100);
      expect(leagues[1].inputScore).toBeCloseTo(100 * (1 - 1 / 3), 5);
      expect(leagues[2].inputScore).toBeCloseTo(100 * (1 - 2 / 3), 5);
    });

    it('should handle single league', () => {
      const leagues = [makeLeague({ name: 'A' })];
      calculateSimpleInputScore(leagues);
      expect(leagues[0].inputScore).toBe(100);
    });

    it('assigns inputScore by rank, not array position', () => {
      const leagues = [
        makeLeague({ name: 'Third', nation: 'X', rank: 3 }),
        makeLeague({ name: 'First', nation: 'Y', rank: 1 }),
        makeLeague({ name: 'Second', nation: 'Z', rank: 2 })
      ];
      calculateSimpleInputScore(leagues);
      const byName = new Map(leagues.map((league) => [league.name, league.inputScore]));
      expect(byName.get('First')).toBeGreaterThan(byName.get('Second') ?? 0);
      expect(byName.get('Second')).toBeGreaterThan(byName.get('Third') ?? 0);
    });
  });

  describe('calculateBasketInputScore', () => {
    it('should assign scores based on stars buckets', () => {
      const leagues = [
        makeLeague({ name: 'A', rank: 1, stars: 5 }),
        makeLeague({ name: 'B', rank: 2, stars: 3 }),
        makeLeague({ name: 'C', rank: 3, stars: 1 })
      ];
      calculateBasketInputScore(leagues);

      // Higher stars = higher input score
      expect(leagues[0].inputScore).toBeGreaterThan(leagues[1].inputScore);
      expect(leagues[1].inputScore).toBeGreaterThan(leagues[2].inputScore);
    });

    it('should handle leagues with same stars', () => {
      const leagues = [
        makeLeague({ name: 'A', rank: 1, stars: 3 }),
        makeLeague({ name: 'B', rank: 2, stars: 3 })
      ];
      calculateBasketInputScore(leagues);

      expect(leagues[0].inputScore).toBeGreaterThan(leagues[1].inputScore);
    });

    it('treats a missing star value as the minimum 0.5 tier, never as zero', () => {
      const missingStars = [makeLeague({ name: 'Missing', rank: 1, stars: null })];
      const minimumStars = [makeLeague({ name: 'Minimum', rank: 1, stars: 0.5 })];

      calculateBasketInputScore(missingStars);
      calculateBasketInputScore(minimumStars);

      expect(missingStars[0]?.inputScore).toBe(minimumStars[0]?.inputScore);
    });
  });

  describe('computeLDC', () => {
    it('should compute ldcRaw and multiplier for simple model', () => {
      ldcSettings.model = 'simple';
      ldcSettings.baseLeague = 'Premier League';
      ldcSettings.leagues = [
        makeLeague({ name: 'Premier League', rank: 1 }),
        makeLeague({ name: 'Championship', rank: 2 }),
        makeLeague({ name: 'League One', rank: 3 })
      ];

      computeLDC();

      const pl = ldcSettings.leagues[0];
      expect(pl.multiplier).toBeCloseTo(1, 5);
      expect(pl.ldcRaw).toBeGreaterThan(0);

      // Lower leagues should have lower multiplier
      expect(ldcSettings.leagues[1].multiplier).toBeLessThan(1);
      expect(ldcSettings.leagues[2].multiplier).toBeLessThan(ldcSettings.leagues[1].multiplier);
    });

    it('should populate ldcCache', () => {
      ldcSettings.leagues = [
        makeLeague({ name: 'Premier League', rank: 1 }),
        makeLeague({ name: 'Serie A', rank: 2 })
      ];
      ldcSettings.baseLeague = 'Premier League';

      computeLDC();

      expect(ldcCache.has('Premier League')).toBe(true);
      expect(ldcCache.has('Serie A')).toBe(true);
    });

    it('keeps same-name leagues from different nations separate in the cache', () => {
      ldcSettings.baseLeague = 'Premier League';
      ldcSettings.baseLeagueNation = 'Anglia';
      ldcSettings.leagues = [
        makeLeague({ name: 'Premier League', nation: 'Anglia', rank: 1 }),
        makeLeague({ name: 'Premier League', nation: 'Egipt', rank: 2 })
      ];

      computeLDC();

      expect(getLDCForLeague('Premier League', null, 'Anglia')).toBeCloseTo(1, 5);
      expect(getLDCForLeague('Premier League', null, 'Egipt')).toBeLessThan(1);
    });

    it('matches an imported league keeping an FM country code against canonicalized player data', () => {
      // Imported lists may carry raw FM codes; identity keys canonicalize
      // nations, so ENG on the league side must meet Anglia/England players.
      ldcSettings.baseLeague = 'Premier League';
      ldcSettings.baseLeagueNation = 'ENG';
      ldcSettings.leagues = [
        makeLeague({ name: 'Premier League', nation: 'ENG', rank: 1 }),
        makeLeague({ name: 'Championship', nation: 'ENG', rank: 2 })
      ];

      computeLDC();

      expect(getLDCForLeague('Championship', null, 'England')).toBeLessThan(1);
      expect(getLDCForLeague('Championship', null, 'Anglia')).toBeLessThan(1);
      expect(getLDCForLeague('Premier League', null, 'ENG')).toBeCloseTo(1, 5);
    });

    it('keeps distinct ldcRaw values for deep simple-model lists (no floor collapse)', () => {
      ldcSettings.model = 'simple';
      ldcSettings.alphaSimple = 5.3;
      ldcSettings.baseLeague = 'League 1';
      ldcSettings.baseLeagueNation = 'Nation 1';
      ldcSettings.leagues = Array.from({ length: 500 }, (_, i) =>
        makeLeague({ name: `League ${i + 1}`, nation: `Nation ${i + 1}`, rank: i + 1, stars: null })
      );

      computeLDC();

      const bottomValues = ldcSettings.leagues.slice(-10).map((league) => league.ldcRaw);
      expect(new Set(bottomValues).size).toBe(bottomValues.length);
      for (const value of bottomValues) {
        expect(value).toBeGreaterThan(0);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Stat Application
  // -----------------------------------------------------------------------

  describe('restoreOriginalStats', () => {
    it('should restore _original values and clean up', () => {
      const player: Record<string, any> = {
        Gls: '5.00',
        Gls_ldc_multiplier: 0.5,
        Gls_original: 10
      };
      restoreOriginalStats(player);

      expect(player.Gls).toBe(10);
      expect(player.Gls_original).toBeUndefined();
      expect(player.Gls_ldc_multiplier).toBeUndefined();
    });

    it('should do nothing when no originals exist', () => {
      const player = { Gls: 10, Name: 'Test' };
      restoreOriginalStats(player);
      expect(player.Gls).toBe(10);
    });
  });

  describe('applyLDCToStats', () => {
    beforeEach(() => {
      ldcSettings.enabled = true;
      ldcSettings.baseLeague = 'Premier League';
      ldcSettings.leagues = [
        makeLeague({ name: 'Premier League', rank: 1 }),
        makeLeague({ name: 'Championship', rank: 2 })
      ];
      computeLDC();
    });

    it('keeps the Shot/90 alias adjusted in lockstep with Shots/90', () => {
      // Shot/90 is created in deriveStats as a plain copy of Shots/90, before
      // LDC runs. Both must carry the same adjustment or filters/roles keyed
      // on the alias would see an unadjusted value for weak-league players.
      const player: Record<string, unknown> = {
        Club: 'Test FC',
        Division: 'Championship',
        'Shot/90': '4.00',
        'Shots/90': '4.00'
      };
      applyLDCToStats(player);
      expect(player['Shot/90']).toBe(player['Shots/90']);
      expect(player['Shot/90']).not.toBe('4.00');
    });

    it('does not persist NaN backups for non-numeric stat values', () => {
      const player: Record<string, unknown> = {
        Club: 'Test FC',
        Division: 'Championship',
        Gls: '-'
      };
      applyLDCToStats(player);
      expect(player.Gls_original).toBeUndefined();
      expect(player.Gls).toBe('-');
    });

    it('should not modify stats when LDC disabled', () => {
      ldcSettings.enabled = false;
      const player = { Club: 'Test FC', Division: 'Championship', Gls: '10' };
      applyLDCToStats(player);
      expect(player.Gls).toBe('10');
    });

    it('should not modify stats for base league (multiplier 1.0)', () => {
      const player = { Club: 'Test FC', Division: 'Premier League', Gls: '10' };
      applyLDCToStats(player);
      // Base league has multiplier 1.0, so stats should be restored not multiplied
      expect(player.Gls).toBe('10');
    });

    it('reverses the adjustment for lower-is-better volume stats', () => {
      const player = {
        Club: 'Test FC',
        Division: 'Championship',
        'Poss Lost/90': '10'
      };

      applyLDCToStats(player);

      expect(Number(player['Poss Lost/90'])).toBeGreaterThan(10);
    });

    it('preserves the meaning of signed higher-is-better stats', () => {
      const positivePlayer = {
        Club: 'Test FC',
        Division: 'Championship',
        'NP-Gls-NP-xG/90': '2'
      };
      const negativePlayer = {
        Club: 'Test FC',
        Division: 'Championship',
        'NP-Gls-NP-xG/90': '-2'
      };

      applyLDCToStats(positivePlayer);
      applyLDCToStats(negativePlayer);

      expect(Number(positivePlayer['NP-Gls-NP-xG/90'])).toBeLessThan(2);
      expect(Number(negativePlayer['NP-Gls-NP-xG/90'])).toBeLessThan(-2);
    });
  });

  describe('getLDCForLeague', () => {
    it('should return 1.0 when disabled', () => {
      ldcSettings.enabled = false;
      expect(getLDCForLeague('Premier League')).toBe(1);
    });

    it('should return 1.0 for empty league', () => {
      expect(getLDCForLeague('')).toBe(1);
    });
  });

  describe('getLDCForLeagueRaw', () => {
    it('should return 1.0 when disabled', () => {
      ldcSettings.enabled = false;
      expect(getLDCForLeagueRaw('Test')).toBe(1);
    });

    it('should return cached value', () => {
      ldcCache.set('Premier League', 1);
      expect(getLDCForLeagueRaw('Premier League')).toBe(1);
    });

    it('should return 1.0 for unknown league', () => {
      expect(getLDCForLeagueRaw('Unknown League ABC')).toBe(1);
    });
  });

  describe('getPlayerLeagueMultiplier', () => {
    it('should return 1.0 for null player', () => {
      expect(getPlayerLeagueMultiplier(null)).toBe(1);
    });

    it('should return 1.0 when disabled', () => {
      ldcSettings.enabled = false;
      expect(getPlayerLeagueMultiplier({ Division: 'Test' })).toBe(1);
    });

    it('should return 1.0 for free agent', () => {
      expect(getPlayerLeagueMultiplier({ Division: '-' })).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Filtering & Tooltip
  // -----------------------------------------------------------------------

  describe('filterPlayersByLDC', () => {
    it('should return all players when disabled', () => {
      ldcSettings.enabled = false;
      const players = [{ Division: 'A' }, { Division: 'B' }];
      expect(filterPlayersByLDC(players)).toHaveLength(2);
    });

    it('should return all players when no bounds set', () => {
      const players = [{ Division: 'A' }, { Division: 'B' }];
      expect(filterPlayersByLDC(players)).toHaveLength(2);
    });
  });

  describe('findClubLeagues', () => {
    it('reads club leagues from the shared player runtime seam', () => {
      setPlayerRuntimeRows([
        { Club: 'Legia', Division: 'Ekstraklasa', uid: '1', 'Based In': 'POL' },
        { Club: 'Legia', Division: 'Ekstraklasa', uid: '2', 'Based In': 'POL' },
        { Club: 'Lech', Division: 'Ekstraklasa', uid: '3', 'Based In': 'POL' }
      ]);

      expect(findClubLeagues('Legia')).toEqual([
        expect.objectContaining({
          country: 'POL',
          league: 'Ekstraklasa'
        })
      ]);
    });

    it('uses a neutral multiplier when only a same-name league from another nation exists', () => {
      ldcSettings.enabled = true;
      ldcSettings.leagues = [
        makeLeague({ name: 'Premier League', nation: 'Anglia', multiplier: 0.8 })
      ];
      ldcCache.set('Premier League', 0.8);
      ldcCache.set('Premier League\u001FAnglia', 0.8);

      expect(getLDCForLeagueRaw('Premier League', 'Egipt')).toBe(1);
    });
  });

  describe('getLDCTooltip', () => {
    it('should return empty when disabled', () => {
      ldcSettings.enabled = false;
      expect(getLDCTooltip('Gls', {})).toBe('');
    });

    it('should return tooltip when original exists', () => {
      const player = {
        Gls: '5.00',
        Gls_ldc_multiplier: 0.5,
        Gls_original: 10
      };
      const tip = getLDCTooltip('Gls', player);
      expect(tip).toContain('10.00');
      expect(tip).toContain('5.00');
    });

    it('should return empty when no original exists', () => {
      expect(getLDCTooltip('Gls', { Gls: 10 })).toBe('');
    });
  });

  // -----------------------------------------------------------------------
  // Data Loading
  // -----------------------------------------------------------------------

  describe('parseLDCCSV', () => {
    it('should parse CSV with name,nation headers', () => {
      const csv = 'name,nation,stars\nPremier League,ENG,5\nSerie A,ITA,4';
      const result = parseLDCCSV(csv);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Premier League');
      // Imported nations are canonicalized (FM code ENG -> Anglia).
      expect(result[0].nation).toBe('Anglia');
      expect(result[0].stars).toBe(5);
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
    });

    it('parses stars regardless of model so switching models never loses data', () => {
      const csv = 'name,nation,stars\nPremier League,ENG,5\nEkstraklasa,POL,3';
      const result = parseLDCCSV(csv);
      expect(result[0].stars).toBe(5);
      expect(result[1].stars).toBe(3);
    });

    it('should return empty for too few lines', () => {
      expect(parseLDCCSV('name,nation')).toEqual([]);
    });

    it('should handle quoted CSV fields', () => {
      const csv = 'name,nation\n"Premier League, England",ENG';
      const result = parseLDCCSV(csv);
      expect(result[0].name).toBe('Premier League, England');
    });

    it('handles escaped double quotes inside quoted CSV values', () => {
      const csv = 'name,nation\n"Liga ""Pro"" A",POL';
      const result = parseLDCCSV(csv);
      expect(result[0].name).toBe('Liga "Pro" A');
    });

    it('should skip rows with empty name', () => {
      const csv = 'name,nation\n,ENG\nSerie A,ITA';
      const result = parseLDCCSV(csv);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Serie A');
    });
  });

  // -----------------------------------------------------------------------
  // Mapping Cache
  // -----------------------------------------------------------------------

  describe('loadLeagueMappings', () => {
    it('should return cached mappings if available', () => {
      ldcMappingState.cache = { A: { name: 'B', nation: '' } };
      expect(loadLeagueMappings()).toEqual({ A: { name: 'B', nation: '' } });
    });

    it('should load from localStorage when cache is null', () => {
      ldcMappingState.cache = null;
      (localStorage.getItem as any).mockReturnValue(JSON.stringify({ X: 'Y' }));
      const result = loadLeagueMappings();
      expect(result).toEqual({ X: { name: 'Y', nation: '' } });
    });

    it('should return empty object on parse error', () => {
      ldcMappingState.cache = null;
      (localStorage.getItem as any).mockReturnValue('invalid json{');
      const result = loadLeagueMappings();
      expect(result).toEqual({});
    });

    it('backfills an empty target nation when the target league name is unique', () => {
      ldcSettings.leagues = [makeLeague({ name: 'Unique Target', nation: 'Portugalia' })];
      ldcMappingState.cache = null;
      (localStorage.getItem as any).mockReturnValue(
        JSON.stringify({ Source: { name: 'Unique Target', nation: '' } })
      );

      expect(loadLeagueMappings()).toEqual({
        Source: { name: 'Unique Target', nation: 'Portugalia' }
      });
    });

    it('does not guess an empty target nation when the target name is ambiguous', () => {
      ldcSettings.leagues = [
        makeLeague({ name: 'Premier League', nation: 'Anglia' }),
        makeLeague({ name: 'Premier League', nation: 'Egipt' })
      ];
      ldcMappingState.cache = null;
      (localStorage.getItem as any).mockReturnValue(
        JSON.stringify({ Source: { name: 'Premier League', nation: '' } })
      );

      expect(loadLeagueMappings()).toEqual({
        Source: { name: 'Premier League', nation: '' }
      });
    });
  });

  describe('saveLeagueMappings', () => {
    it('should save to cache and localStorage', () => {
      saveLeagueMappings({ A: 'B' });
      expect(ldcMappingState.cache).toEqual({ A: { name: 'B', nation: '' } });
      expect((localStorage.setItem as any).mock.calls).toContainEqual([
        'fm24-evaluator-ldc-mappings-v1',
        JSON.stringify({ A: { name: 'B', nation: '' } })
      ]);
    });
  });

  describe('addLeagueMapping', () => {
    it('should add mapping and persist', () => {
      ldcMappingState.cache = {};
      addLeagueMapping('Source', 'Target');
      expect(ldcMappingState.cache).toEqual({ Source: { name: 'Target', nation: '' } });
    });

    it('stores independent mappings for same-name source leagues from different nations', () => {
      ldcMappingState.cache = {};

      addLeagueMapping(
        { name: 'Premier League', nation: 'Anglia' },
        { name: 'Premier League', nation: 'Anglia' }
      );
      addLeagueMapping(
        { name: 'Premier League', nation: 'Egipt' },
        { name: 'Premier League', nation: 'Egipt' }
      );

      const mappings = loadLeagueMappings();
      expect(getMappingTarget(mappings, 'Premier League', 'Anglia')).toEqual({
        name: 'Premier League',
        nation: 'Anglia'
      });
      expect(getMappingTarget(mappings, 'Premier League', 'Egipt')).toEqual({
        name: 'Premier League',
        nation: 'Egipt'
      });
    });

    it('does not apply an unscoped mapping to a source league with an explicit country', () => {
      const mappings = {
        'Premier League': { name: 'Premier League', nation: 'Anglia' }
      };

      expect(getMappingTarget(mappings, 'Premier League', 'Egipt')).toBeNull();
    });

    it('does not resolve an explicitly country-scoped target by name alone', () => {
      const leagues = [makeLeague({ name: 'Premier League', nation: 'Anglia' })];

      expect(
        resolveMappingTargetLeague({ name: 'Premier League', nation: 'Egipt' }, leagues)
      ).toBeNull();
    });
  });

  describe('removeLeagueMapping', () => {
    it('should remove mapping and persist', () => {
      ldcMappingState.cache = {
        A: { name: 'B', nation: '' },
        C: { name: 'D', nation: '' }
      };
      removeLeagueMapping('A');
      expect(ldcMappingState.cache).toEqual({ C: { name: 'D', nation: '' } });
    });
  });
});
