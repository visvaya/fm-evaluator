import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/ldcStorage', () => ({
  loadSettings: vi.fn(() => Promise.resolve(null)),
  saveSettings: vi.fn(() => Promise.resolve())
}));

import { loadSettings as loadLdcStoredSettings } from '@/ldcStorage';

import { loadPersistedLdcSettings } from './ldcPersistence';

describe('loadPersistedLdcSettings', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', {});
    vi.stubGlobal('addAudit', vi.fn());
  });

  it('canonicalizes league nations and baseLeagueNation loaded from storage', async () => {
    vi.mocked(loadLdcStoredSettings).mockResolvedValueOnce({
      alphaBasket: 1.7,
      alphaSimple: 5.3,
      baseLeague: 'Premier League',
      baseLeagueNation: 'ENG',
      enabled: true,
      leagues: [
        {
          inputScore: 0,
          ldcRaw: 0,
          multiplier: 1,
          name: 'Premier League',
          nation: 'ENG',
          rank: 1,
          stars: 5
        }
      ],
      mappings: {},
      model: 'basket'
    });

    const payload = await loadPersistedLdcSettings();

    expect(payload?.baseLeagueNation).toBe('Anglia');
    expect(payload?.leagues[0]?.nation).toBe('Anglia');
  });
});
