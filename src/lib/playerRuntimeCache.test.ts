import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearPlayerRuntimeRows,
  getPlayerRuntimeRows,
  setPlayerRuntimeRows
} from './playerRuntimeCache';

describe('playerRuntimeCache', () => {
  beforeEach(() => {
    clearPlayerRuntimeRows();
  });

  it('stores and clears the current runtime rows', () => {
    const rows = [{ Division: 'Premier League', uid: '1' }];

    setPlayerRuntimeRows(rows);
    expect(getPlayerRuntimeRows()).toEqual(rows);

    clearPlayerRuntimeRows();
    expect(getPlayerRuntimeRows()).toEqual([]);
  });
});
