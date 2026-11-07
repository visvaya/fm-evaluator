// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ldcMappingState, ldcSettings } from '@/config/ldcConfig';

import { useLdcStore } from './useLdcStore';

import type { LeagueData } from '@/config/ldcConfig';

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

describe('useLdcStore', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] || null),
      removeItem: vi.fn((key: string) => {
        store[key] = '';
      }),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      })
    });
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('addAudit', vi.fn());
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('DEFAULT_LEAGUE_DATA', [
      { name: 'Premier League', nation: 'ENG', stars: 5 },
      { name: 'Serie A', nation: 'ITA', stars: 4 }
    ]);
    window.location = { protocol: 'http:' } as Location;
    ldcMappingState.cache = null;
    ldcMappingState.initPromise = null;
    useLdcStore.setState({
      basketProblems: [],
      historyIndex: -1,
      historyStack: [],
      isHydrated: false,
      isHydrating: false,
      orderProblems: [],
      settings: {
        alphaBasket: 1.7,
        alphaSimple: 5.3,
        baseLeague: 'Premier League',
        enabled: false,
        groupBy: null,
        leagues: [],
        model: 'basket',
        sortColumn: 'rank',
        sortDirection: 'asc'
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hydrates from persisted payload and seeds history', async () => {
    (localStorage.getItem as any).mockReturnValue(
      JSON.stringify({
        alphaBasket: 2.1,
        alphaSimple: 6.2,
        baseLeague: 'Serie A',
        enabled: true,
        leagues: [makeLeague({ name: 'Serie A', nation: 'ITA', rank: 1, stars: 4 })],
        mappings: { Ekstraklasa: 'Serie A' },
        model: 'basket'
      })
    );

    await useLdcStore.getState().hydrateFromPersistence();

    const state = useLdcStore.getState();
    expect(state.isHydrated).toBe(true);
    expect(state.settings.enabled).toBe(true);
    expect(state.settings.baseLeague).toBe('Serie A');
    expect(state.historyStack).toHaveLength(1);
    expect(state.historyStack[0]?.mappings).toEqual({
      Ekstraklasa: { name: 'Serie A', nation: '' }
    });
    expect(ldcSettings.baseLeague).toBe('Serie A');
  });

  it('captures legacy mutations into store history and supports undo/redo', async () => {
    await useLdcStore.getState().hydrateFromPersistence();

    ldcSettings.baseLeague = 'Serie A';
    ldcSettings.leagues = [
      makeLeague({ name: 'Premier League', nation: 'ENG', rank: 1, stars: 5 }),
      makeLeague({ name: 'Serie A', nation: 'ITA', rank: 2, stars: 4 })
    ];

    await useLdcStore.getState().syncFromLegacy();

    let state = useLdcStore.getState();
    expect(state.historyStack).toHaveLength(2);
    expect(state.historyIndex).toBe(1);
    expect(state.settings.baseLeague).toBe('Serie A');

    expect(useLdcStore.getState().undo()).toBe(true);
    state = useLdcStore.getState();
    expect(state.historyIndex).toBe(0);
    expect(state.settings.baseLeague).toBe('Premier League');

    expect(useLdcStore.getState().redo()).toBe(true);
    state = useLdcStore.getState();
    expect(state.historyIndex).toBe(1);
    expect(state.settings.baseLeague).toBe('Serie A');
  });

  it('updates alpha values through store actions and records history', async () => {
    await useLdcStore.getState().hydrateFromPersistence();

    useLdcStore.getState().setAlphaBasket(2.4);

    const state = useLdcStore.getState();
    expect(state.settings.alphaBasket).toBe(2.4);
    expect(state.historyStack).toHaveLength(2);
    expect(state.historyIndex).toBe(1);
  });

  it('coalesces rapid alpha changes into a single history entry', async () => {
    await useLdcStore.getState().hydrateFromPersistence();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T12:00:00Z'));
    const before = useLdcStore.getState().historyStack.length;

    useLdcStore.getState().setAlphaBasket(1.8);
    vi.setSystemTime(new Date('2026-07-18T12:00:00.200Z'));
    useLdcStore.getState().setAlphaBasket(1.9);
    vi.setSystemTime(new Date('2026-07-18T12:00:00.400Z'));
    useLdcStore.getState().setAlphaBasket(2);

    expect(useLdcStore.getState().historyStack).toHaveLength(before + 1);
    expect(useLdcStore.getState().settings.alphaBasket).toBe(2);
    vi.useRealTimers();
  });

  it('creates separate history entries when alpha changes are far apart', async () => {
    await useLdcStore.getState().hydrateFromPersistence();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T12:00:00Z'));
    const before = useLdcStore.getState().historyStack.length;

    useLdcStore.getState().setAlphaBasket(1.8);
    vi.setSystemTime(new Date('2026-07-18T12:00:02Z'));
    useLdcStore.getState().setAlphaBasket(1.9);

    expect(useLdcStore.getState().historyStack).toHaveLength(before + 2);
    vi.useRealTimers();
  });

  it('changes model without replacing the current league list', async () => {
    await useLdcStore.getState().hydrateFromPersistence();
    ldcSettings.leagues = [
      makeLeague({ id: 'one', name: 'Custom One', rank: 1, stars: 4 }),
      makeLeague({ id: 'two', name: 'Custom Two', rank: 2, stars: null })
    ];
    await useLdcStore.getState().syncFromLegacy();

    useLdcStore.getState().setModel('simple');
    useLdcStore.getState().setModel('basket');

    const leagues = useLdcStore.getState().settings.leagues;
    expect(leagues.map((league) => league.name)).toEqual(['Custom One', 'Custom Two']);
    expect(leagues[0]?.stars).toBe(4);
    expect(leagues[1]?.stars).toBe(4.5);
  });

  it('persists enabled toggle when no edit session is active', async () => {
    await useLdcStore.getState().hydrateFromPersistence();
    (localStorage.setItem as any).mockClear();

    useLdcStore.getState().setEnabled(true);
    await Promise.resolve();

    const keys = (localStorage.setItem as any).mock.calls.map((call: unknown[]) => call[0]);
    expect(keys).toContain('fm24-evaluator-ldc-v1');
  });

  it('defers persistSettings while an edit session is active', async () => {
    await useLdcStore.getState().hydrateFromPersistence();
    useLdcStore.getState().beginEditSession();
    (localStorage.setItem as any).mockClear();

    await useLdcStore.getState().persistSettings();

    const keys = (localStorage.setItem as any).mock.calls.map((call: unknown[]) => call[0]);
    expect(keys).not.toContain('fm24-evaluator-ldc-v1');
  });

  it('does not persist enabled toggle during an edit session', async () => {
    await useLdcStore.getState().hydrateFromPersistence();
    useLdcStore.getState().beginEditSession();
    (localStorage.setItem as any).mockClear();

    useLdcStore.getState().setEnabled(true);
    await Promise.resolve();

    const keys = (localStorage.setItem as any).mock.calls.map((call: unknown[]) => call[0]);
    expect(keys).not.toContain('fm24-evaluator-ldc-v1');
  });

  it('reports duplicate-LDC problems in simple model', async () => {
    ldcSettings.model = 'simple';
    ldcSettings.leagues = [
      makeLeague({ ldcRaw: 0.25, name: 'A', nation: 'X', rank: 1, stars: null }),
      makeLeague({ ldcRaw: 0.25, name: 'B', nation: 'Y', rank: 2, stars: null })
    ];

    await useLdcStore.getState().syncFromLegacy({ pushHistory: false });

    expect(useLdcStore.getState().basketProblems.length).toBeGreaterThan(0);
  });

  it('restores the edit-session baseline when changes are cancelled', async () => {
    await useLdcStore.getState().hydrateFromPersistence();
    useLdcStore.getState().beginEditSession();
    useLdcStore.getState().setAlphaBasket(3.4);

    await useLdcStore.getState().cancelEditSession();

    expect(useLdcStore.getState().settings.alphaBasket).toBe(1.7);
    expect(ldcSettings.alphaBasket).toBe(1.7);
  });
});
