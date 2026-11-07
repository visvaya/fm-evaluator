// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processor } from '@/data/dataProcessor';
import { clearPlayerRuntimeRows, getPlayerRuntimeRows } from '@/lib/playerRuntimeCache';
import { store as legacyTableStore } from '@/store/tableStore';
import { useTableStore } from '@/store/useTableStore';

import { runAnalysis } from './analysisService';

describe('analysisService', () => {
  let calculateScoresMock: ReturnType<typeof vi.fn<(engine: unknown, position: unknown) => void>>;

  beforeEach(() => {
    vi.restoreAllMocks();
    clearPlayerRuntimeRows();
    (
      window as Window & {
        APP_SETTINGS?: { adaptiveMinMins: null | number; minMins: null | number };
      }
    ).APP_SETTINGS = {
      adaptiveMinMins: null,
      minMins: null
    };
    processor.calculatedScores = [];
    calculateScoresMock = vi.fn<(engine: unknown, position: unknown) => void>();
    processor.calculateScores = calculateScoresMock;
    legacyTableStore.filteredDataCache = [{ stale: true }];
    legacyTableStore.lastSortedRows = [{ stale: true }];

    useTableStore.setState({
      analysisReady: false,
      comparisonRuntime: null,
      currentEngine: 'Default',
      currentPosition: '',
      data: [],
      filteredData: [],
      isAnalyzing: false
    });
  });

  it('runs analysis through the explicit service and updates React state', () => {
    processor.calculatedScores = [{ uid: '1', name: 'Player' }] as any;
    processor.filterDistributionCache = new Map([['BEST', { Fin: { max: 18, min: 8 } }]]) as any;
    processor.mergedData = [{ Fin: 12, Mins: 1200, Position: 'DC', uid: 'base' }] as any;

    const results = runAnalysis('FMTweak', 'BEST');

    expect(calculateScoresMock).toHaveBeenCalledWith('FMTweak', 'BEST');
    expect(results).toEqual([{ uid: '1', name: 'Player' }]);
    expect(useTableStore.getState().currentEngine).toBe('FMTweak');
    expect(useTableStore.getState().currentPosition).toBe('BEST');
    expect(useTableStore.getState().data).toEqual(results);
    expect(useTableStore.getState().filteredData).toEqual(results);
    expect(useTableStore.getState().analysisReady).toBe(true);
    expect(useTableStore.getState().isAnalyzing).toBe(false);
    expect(useTableStore.getState().comparisonRuntime).toMatchObject({
      filterDistributionCache: processor.filterDistributionCache,
      maxBeeswarmPlayers: expect.any(Number),
      mergedData: processor.mergedData
    });
    expect(getPlayerRuntimeRows()).toEqual(processor.mergedData);
    expect(legacyTableStore.filteredDataCache).toEqual([]);
    expect(legacyTableStore.lastSortedRows).toEqual([]);
  });

  it('returns no rows when no position is selected', () => {
    const results = runAnalysis('FMTweak', '');

    expect(results).toEqual([]);
    expect(calculateScoresMock).not.toHaveBeenCalled();
  });
});
