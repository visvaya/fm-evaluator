import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../ldcStorage', () => ({
  loadMappings: vi.fn(() => Promise.resolve({})),
  saveMappings: vi.fn(() => Promise.resolve())
}));

import { ldcMappingState } from '../config/ldcConfig';
import { saveMappings } from '../ldcStorage';

import {
  beginMappingsTransaction,
  commitMappingsTransaction,
  loadLeagueMappings,
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
