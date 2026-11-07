import { beforeEach, describe, expect, it } from 'vitest';

import { clearPlayerRuntimeRows, setPlayerRuntimeRows } from '@/lib/playerRuntimeCache';
import { useTableStore } from '@/store/useTableStore';

import {
  getActivePlayerRows,
  hasActivePlayerRows,
  hasAnalyzedPlayerRows
} from './playerRowsRuntime';

describe('playerRowsRuntime', () => {
  beforeEach(() => {
    clearPlayerRuntimeRows();
    useTableStore.setState({
      analysisReady: false,
      data: []
    });
  });

  it('returns imported runtime rows before analysis', () => {
    setPlayerRuntimeRows([{ uid: 'imported-1' }] as any[]);

    expect(getActivePlayerRows()).toEqual([{ uid: 'imported-1' }]);
    expect(hasActivePlayerRows()).toBe(true);
    expect(hasAnalyzedPlayerRows()).toBe(false);
  });

  it('returns analyzed store rows after analysis becomes ready', () => {
    setPlayerRuntimeRows([{ uid: 'imported-1' }] as any[]);
    useTableStore.setState({
      analysisReady: true,
      data: [{ uid: 'analyzed-1' }] as any[]
    });

    expect(getActivePlayerRows()).toEqual([{ uid: 'analyzed-1' }]);
    expect(hasActivePlayerRows()).toBe(true);
    expect(hasAnalyzedPlayerRows()).toBe(true);
  });
});
