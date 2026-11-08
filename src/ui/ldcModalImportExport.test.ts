// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadLeagueMappings } from '@/computing/ldcMappings';
import { ldcMappingState, ldcSettings } from '@/config/ldcConfig';

import {
  exportLdcMappingsAction,
  importLdcMappingsFileAction,
  importLdcSettingsFileAction
} from './ldcModalImportExport';

describe('ldcModalImportExport actions', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};

    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] || null),
      removeItem: vi.fn((key: string) => {
        store[key] = '';
      }),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      })
    });
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false)
    );
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('addAudit', vi.fn());
    vi.stubGlobal('DEFAULT_LEAGUE_DATA', [
      { name: 'Premier League', nation: 'ENG', stars: 5 },
      { name: 'Serie A', nation: 'ITA', stars: 4 }
    ]);

    ldcMappingState.cache = null;
    ldcMappingState.initPromise = null;
    ldcSettings.alphaBasket = 1.7;
    ldcSettings.alphaSimple = 5.3;
    ldcSettings.baseLeague = 'Premier League';
    ldcSettings.enabled = false;
    ldcSettings.groupBy = null;
    ldcSettings.leagues = [];
    ldcSettings.model = 'basket';
    ldcSettings.sortColumn = 'rank';
    ldcSettings.sortDirection = 'asc';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('imports mappings from a JSON file', async () => {
    const file = new File(
      [JSON.stringify({ mappings: { Ekstraklasa: 'Premier League' } })],
      'mappings.json',
      { type: 'application/json' }
    );

    await importLdcMappingsFileAction(file, {
      calculateLDC: vi.fn(),
      onMappingsChanged: vi.fn(),
      onSettingsChanged: vi.fn()
    });

    expect(loadLeagueMappings()).toEqual({
      Ekstraklasa: { name: 'Premier League', nation: '' }
    });
  });

  it('imports LDC settings and leagues from a JSON file', async () => {
    const file = new File(
      [
        JSON.stringify({
          alphaBasket: 2.2,
          alphaSimple: 6.1,
          baseLeague: 'Serie A',
          enabled: true,
          leagues: [
            {
              inputScore: 0,
              ldcRaw: 0,
              multiplier: 1,
              name: 'Serie A',
              nation: 'ITA',
              rank: 1,
              stars: 4
            }
          ],
          mappings: { Ekstraklasa: 'Serie A' },
          model: 'basket'
        })
      ],
      'ldc-settings.json',
      { type: 'application/json' }
    );
    const calculateLDC = vi.fn();
    const onSettingsChanged = vi.fn();

    await importLdcSettingsFileAction(file, {
      calculateLDC,
      onMappingsChanged: vi.fn(),
      onSettingsChanged
    });

    expect(ldcSettings.baseLeague).toBe('Serie A');
    expect(ldcSettings.enabled).toBe(true);
    expect(ldcSettings.alphaBasket).toBe(2.2);
    expect(ldcSettings.leagues).toHaveLength(1);
    expect(ldcSettings.leagues[0]?.name).toBe('Serie A');
    // JSON payloads may carry raw FM codes (from exports predating the fix,
    // or hand-edited files); imported leagues must be canonicalized.
    expect(ldcSettings.leagues[0]?.nation).toBe('Włochy');
    // The mapping target's nation is resolved from the (now canonical)
    // imported league, so it comes back as the canonical Polish name, not the raw 'ITA'.
    expect(loadLeagueMappings()).toEqual({
      Ekstraklasa: { name: 'Serie A', nation: 'Włochy' }
    });
    expect(calculateLDC).toHaveBeenCalled();
    expect(onSettingsChanged).toHaveBeenCalled();
  });

  it('canonicalizes baseLeagueNation from a JSON settings import', async () => {
    const file = new File(
      [
        JSON.stringify({
          baseLeague: 'Premier League',
          baseLeagueNation: 'ENG',
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
          ]
        })
      ],
      'ldc-settings.json',
      { type: 'application/json' }
    );

    await importLdcSettingsFileAction(file, {
      calculateLDC: vi.fn(),
      onMappingsChanged: vi.fn(),
      onSettingsChanged: vi.fn()
    });

    expect(ldcSettings.baseLeagueNation).toBe('Anglia');
  });

  it('exports mappings as a standalone JSON file', () => {
    localStorage.setItem(
      'fm24-evaluator-ldc-mappings-v1',
      JSON.stringify({ Ekstraklasa: 'Premier League' })
    );

    const click = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElement = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return { click, download: '', href: '' } as unknown as HTMLElement;
        }
        return originalCreateElement(tagName);
      });
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL
    });

    exportLdcMappingsAction();

    expect(createElement).toHaveBeenCalledWith('a');
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});
