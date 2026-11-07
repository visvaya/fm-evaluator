// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadDefaultLDCData } from './ldcLoading';

describe('loadDefaultLDCData', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'DEFAULT_LEAGUE_DATA');
    Reflect.deleteProperty(window, 'addAudit');
  });

  it('maps embedded league data with ranks and canonical nations', async () => {
    (window as any).DEFAULT_LEAGUE_DATA = [
      { name: 'Premier League', nation: 'ENG', stars: 5 },
      { name: 'Championship', nation: 'ENG' }
    ];

    const leagues = await loadDefaultLDCData();

    expect(leagues).toHaveLength(2);
    expect(leagues[0]).toMatchObject({ name: 'Premier League', rank: 1, stars: 5 });
    expect(leagues[1]).toMatchObject({ name: 'Championship', rank: 2, stars: null });
    expect(leagues[0].nation).toBe(leagues[1].nation);
  });

  it('reports missing embedded data without fetching a league file', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const addAudit = vi.fn();
    (window as any).addAudit = addAudit;

    const leagues = await loadDefaultLDCData();

    expect(leagues).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(addAudit).toHaveBeenCalledWith(
      'ldc_load_default_error',
      { error: 'no-embedded-data' },
      'error'
    );
    expect(console.error).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
