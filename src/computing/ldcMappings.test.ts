import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../ldcStorage', () => ({
  loadMappings: vi.fn(() => Promise.resolve({})),
  saveMappings: vi.fn(() => Promise.resolve())
}));

import { type LeagueData, ldcMappingState } from '../config/ldcConfig';
import { saveMappings } from '../ldcStorage';

import {
  beginMappingsTransaction,
  commitMappingsTransaction,
  loadLeagueMappings,
  normalizeLeagueMappings,
  rollbackMappingsTransaction,
  saveLeagueMappings
} from './ldcMappings';

const setItemMock = vi.fn();

describe('mappings transaction', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      removeItem: vi.fn(),
      setItem: setItemMock
    });
    // Make canUseLdcStorageModule() return true so the Dexie path is exercised.
    vi.stubGlobal('indexedDB', {});
    ldcMappingState.cache = {};
    vi.mocked(saveMappings).mockClear();
    setItemMock.mockClear();
  });

  afterEach(() => {
    rollbackMappingsTransaction();
    vi.unstubAllGlobals();
  });

  it('does not persist mapping writes while a transaction is active', () => {
    beginMappingsTransaction();
    saveLeagueMappings({ Source: { name: 'Target', nation: 'X' } });

    expect(saveMappings).not.toHaveBeenCalled();
    expect(setItemMock).not.toHaveBeenCalled();
    expect(loadLeagueMappings().Source).toEqual({ name: 'Target', nation: 'X' });
  });

  it('persists exactly once on commit', () => {
    beginMappingsTransaction();
    saveLeagueMappings({ A: { name: 'T1', nation: 'X' } });
    saveLeagueMappings({ A: { name: 'T1', nation: 'X' }, B: { name: 'T2', nation: 'Y' } });
    commitMappingsTransaction();

    expect(saveMappings).toHaveBeenCalledTimes(1);
    expect(setItemMock).toHaveBeenCalledTimes(1);
  });

  it('restores the pre-transaction cache on rollback without persisting', () => {
    saveLeagueMappings({ Existing: { name: 'Old', nation: 'X' } });
    vi.mocked(saveMappings).mockClear();
    setItemMock.mockClear();

    beginMappingsTransaction();
    saveLeagueMappings({ Draft: { name: 'New', nation: 'Y' } });
    rollbackMappingsTransaction();

    expect(saveMappings).not.toHaveBeenCalled();
    expect(setItemMock).not.toHaveBeenCalled();
    expect(loadLeagueMappings().Existing).toEqual({ name: 'Old', nation: 'X' });
    expect(loadLeagueMappings().Draft).toBeUndefined();
  });
});

function league(name: string, nation: string): LeagueData {
  return {
    inputScore: 0,
    ldcRaw: 0,
    multiplier: 1,
    name,
    nation,
    rank: 1,
    stars: 3
  };
}

describe('normalizeLeagueMappings', () => {
  it('fills the nation from a unique exact or normalized name match', () => {
    const leagues = [league('III Liga', 'Polska'), league('Premier League', 'Anglia')];

    expect(
      normalizeLeagueMappings(
        { A: 'Premier League', B: 'III Liga - Grupa 2', C: { name: 'III Liga', nation: 'Polska' } },
        leagues
      )
    ).toEqual({
      A: { name: 'Premier League', nation: 'Anglia' },
      B: { name: 'III Liga - Grupa 2', nation: 'Polska' },
      C: { name: 'III Liga', nation: 'Polska' }
    });
  });

  it('leaves the nation empty when the name is ambiguous', () => {
    const leagues = [league('Liga', 'Polska'), league('Liga', 'Anglia')];

    expect(normalizeLeagueMappings({ A: 'Liga' }, leagues)).toEqual({
      A: { name: 'Liga', nation: '' }
    });
  });

  it('resolves many mappings against many leagues quickly', () => {
    const leagues = Array.from({ length: 3000 }, (_, index) => league(`League ${index}`, 'X'));
    const mappings = Object.fromEntries(
      Array.from({ length: 3000 }, (_, index) => [`Source ${index}`, `Missing ${index}`])
    );
    const started = performance.now();

    normalizeLeagueMappings(mappings, leagues);

    expect(performance.now() - started).toBeLessThan(1000);
  });
});
