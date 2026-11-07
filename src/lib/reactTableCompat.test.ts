// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { store as legacyTableStore } from '@/store/tableStore';
import { useTableStore } from '@/store/useTableStore';

import { getReactTableRows, requestTableSync } from './reactTableCompat';

describe('reactTableCompat', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    legacyTableStore.currentSort = { col: 'name', dir: 'asc' };
    legacyTableStore.filterDirty = true;
    legacyTableStore.filteredDataCache = [];

    useTableStore.setState({
      analysisReady: false,
      compatRevision: 0,
      currentSort: { col: 'totalScore', dir: 'desc' },
      data: [],
      filteredData: [],
      searchQuery: ''
    });
  });

  it('bumps compat revision and mirrors legacy sort state', () => {
    requestTableSync();

    expect(useTableStore.getState().compatRevision).toBe(1);
    expect(useTableStore.getState().currentSort).toEqual({ col: 'name', dir: 'asc' });
  });

  it('uses legacy filtered rows when analyzed scores exist', () => {
    legacyTableStore.filterDirty = false;
    legacyTableStore.filteredDataCache = [
      { club: 'Club B', league: 'Beta', name: 'Bravo', uid: '2' },
      { club: 'Club A', league: 'Alpha', name: 'Alpha', uid: '1' }
    ];
    useTableStore.setState({
      analysisReady: true,
      data: [{ uid: 'seed' }] as any[]
    });

    const rows = getReactTableRows([], 'alp');

    expect(rows).toEqual([expect.objectContaining({ name: 'Alpha', uid: '1' })]);
  });

  it('falls back to imported rows before analysis', () => {
    useTableStore.setState({
      analysisReady: false,
      data: []
    });

    const rows = getReactTableRows(
      [
        { club: 'Club B', league: 'Beta', name: 'Bravo', statScore: 71, totalScore: 72, uid: '2' },
        { club: 'Club A', league: 'Alpha', name: 'Alpha', statScore: 81, totalScore: 82, uid: '1' }
      ],
      ''
    );

    expect(rows.map((row) => row.name)).toEqual(['Alpha', 'Bravo']);
  });
});
