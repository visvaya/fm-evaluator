// @vitest-environment jsdom
/* eslint-disable import-x/no-namespace */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processor } from '@/data/dataProcessor';
import { clearPlayerRuntimeRows, getPlayerRuntimeRows } from '@/lib/playerRuntimeCache';
import { useTableStore } from '@/store/useTableStore';

import * as analysisServiceModule from './analysisService';
import { registerImportFlowBridge } from './importFlowBridge';

describe('importFlowBridge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearPlayerRuntimeRows();
    processor.mergedData = [];
    processor.calculatedScores = [];
    processor.fileStack = [];
    processor.mergeData = vi.fn();

    useTableStore.setState({
      analysisReady: false,
      comparisonRuntime: {
        cleanValue: (value) => value as any,
        filterDistributionCache: new Map(),
        maxBeeswarmPlayers: 500,
        mergedData: [],
        minMins: 90
      },
      compatRevision: 0,
      currentEngine: 'Default',
      currentPosition: '',
      data: [],
      filteredData: [],
      importStatus: {
        canRetry: false,
        details: [],
        kind: 'idle',
        message: ''
      },
      mergeMode: 'merge'
    });

    registerImportFlowBridge();
  });

  it('normalizes merged players into the React table state', () => {
    processor.mergedData = [
      {
        Club: 'Legia',
        Division: 'Ekstraklasa',
        Name: 'Jan Kowalski',
        UID: 42
      }
    ];

    (window as Window & { onContinueFileProcessing?: () => void }).onContinueFileProcessing?.();

    const state = useTableStore.getState();
    expect(state.analysisReady).toBe(false);
    expect(state.comparisonRuntime).toBeNull();
    expect(getPlayerRuntimeRows()).toEqual([
      expect.objectContaining({
        club: 'Legia',
        league: 'Ekstraklasa',
        name: 'Jan Kowalski',
        uid: '42'
      })
    ]);
    expect(state.data).toEqual([
      expect.objectContaining({
        club: 'Legia',
        league: 'Ekstraklasa',
        name: 'Jan Kowalski',
        uid: '42'
      })
    ]);
    expect(state.importStatus.kind).toBe('success');
  });

  it('lists the files with cut cells in the import status', () => {
    processor.fileStack = [
      { cutCells: [], name: 'clean.html' },
      {
        cutCells: [
          { column: 'Notes', count: 2 },
          { column: 'Name', count: 1 }
        ],
        name: 'long.html'
      }
    ];
    processor.mergedData = [{ Name: 'Player', UID: 7 }];

    (window as Window & { onContinueFileProcessing?: () => void }).onContinueFileProcessing?.();

    const { details, kind } = useTableStore.getState().importStatus;
    expect(kind).toBe('success');
    expect(details).toHaveLength(1);
    expect(details[0]).toContain('long.html');
    expect(details[0]).toContain('Notes (2), Name (1)');
    expect(details[0]).toContain('10000');
  });

  it('reruns analysis when a role is already selected', () => {
    const runAnalysis = vi.spyOn(analysisServiceModule, 'runAnalysis').mockReturnValue([]);
    useTableStore.setState({
      currentEngine: 'FMTweak',
      currentPosition: 'BEST'
    });
    processor.mergedData = [{ Name: 'Player', UID: 7 }];

    (window as Window & { onContinueFileProcessing?: () => void }).onContinueFileProcessing?.();

    expect(runAnalysis).toHaveBeenCalledWith('FMTweak', 'BEST');
  });

  it('clears stale analyzed rows before exposing imported data', () => {
    processor.calculatedScores = [{ uid: 'stale-analysis' }] as any;
    processor.mergedData = [{ Club: 'Legia', Name: 'Fresh Import', UID: 7 }];

    (window as Window & { onContinueFileProcessing?: () => void }).onContinueFileProcessing?.();

    expect(processor.calculatedScores).toEqual([]);
    expect(useTableStore.getState().comparisonRuntime).toBeNull();
    expect(getPlayerRuntimeRows()).toEqual([
      expect.objectContaining({
        name: 'Fresh Import',
        uid: '7'
      })
    ]);
    expect(useTableStore.getState().data).toEqual([
      expect.objectContaining({
        name: 'Fresh Import',
        uid: '7'
      })
    ]);
  });

  it('restores imported rows when automatic analysis returns no rows', () => {
    vi.spyOn(analysisServiceModule, 'runAnalysis').mockImplementation(() => {
      useTableStore.getState().setData([]);
      useTableStore.getState().setFilteredData([]);
      useTableStore.getState().setAnalysisReady(false);
      return [];
    });
    useTableStore.setState({
      currentEngine: 'FMTweak',
      currentPosition: 'BEST'
    });
    processor.mergedData = [{ Club: 'Legia', Name: 'Fallback Player', UID: 9 }];

    (window as Window & { onContinueFileProcessing?: () => void }).onContinueFileProcessing?.();

    expect(useTableStore.getState().data).toEqual([
      expect.objectContaining({
        name: 'Fallback Player',
        uid: '9'
      })
    ]);
    expect(useTableStore.getState().importStatus).toEqual({
      canRetry: false,
      details: [],
      kind: 'info',
      message:
        'Imported 1 player rows. Automatic analysis for BEST returned 0 rows, so the imported table is shown.'
    });
    expect(useTableStore.getState().comparisonRuntime).toBeNull();
    expect(getPlayerRuntimeRows()).toEqual([
      expect.objectContaining({
        name: 'Fallback Player',
        uid: '9'
      })
    ]);
  });

  it('sets an error status when the import produced no rows', () => {
    processor.mergedData = [];

    (window as Window & { onContinueFileProcessing?: () => void }).onContinueFileProcessing?.();

    expect(useTableStore.getState().importStatus).toEqual({
      canRetry: false,
      details: [],
      kind: 'error',
      message: 'No player data was produced from the imported files.'
    });
    expect(getPlayerRuntimeRows()).toEqual([]);
  });
});
