// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useTableStore } from '@/store/useTableStore';

import { usePlayerTable } from './usePlayerTable';

type TableView = ReturnType<typeof usePlayerTable>;

describe('usePlayerTable', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: TableView | null = null;

  function Probe() {
    latest = usePlayerTable();
    return null;
  }

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const players = Array.from({ length: 5 }, (_, index) => ({
      name: `P${index}`,
      statScore: 0,
      totalScore: 0,
      uid: String(index)
    }));
    useTableStore.setState({ data: players, filteredData: players, rowsPerPage: 2 });
    useTableStore.getState().setCurrentPage(1);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    latest = null;
  });

  it('shows the current page in the page box again after the page changes', () => {
    act(() => root.render(createElement(Probe)));
    expect(latest?.pageInput).toBe('1');

    act(() => latest?.setPageInput('3x'));
    expect(latest?.pageInput).toBe('3x');

    act(() => useTableStore.getState().setCurrentPage(2));
    expect(latest?.currentPage).toBe(2);
    expect(latest?.pageInput).toBe('2');
  });

  it('builds one row per player on the current page', () => {
    act(() => root.render(createElement(Probe)));
    expect(latest?.filteredRows).toHaveLength(2);
    expect(latest?.pageCount).toBe(3);
  });
});
