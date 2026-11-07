// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTableStore } from '@/store/useTableStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';

import { useAppShortcuts } from './shortcuts';

const closeFiltersMock = vi.fn();
const focusNameColumnFilterMock = vi.fn();
const isAnyColumnFilterOpenMock = vi.fn(() => false);

vi.mock('@/ui/filters', () => ({
  closeFilters: (...args: unknown[]) => closeFiltersMock(...args),
  focusNameColumnFilter: () => focusNameColumnFilterMock(),
  isAnyColumnFilterOpen: () => isAnyColumnFilterOpenMock()
}));

function HookHost() {
  useAppShortcuts();
  return null;
}

describe('useAppShortcuts', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    useTableStore.setState({
      activeFilters: {},
      analysisReady: false,
      bootstrap: { error: null, ready: true },
      compatRevision: 0,
      currentEngine: 'Default',
      currentPage: 1,
      currentPosition: '',
      currentSort: { col: 'totalScore', dir: 'desc' },
      data: [],
      filteredData: [],
      importStatus: {
        canRetry: false,
        details: [],
        kind: 'idle',
        message: ''
      },
      isAnalyzing: false,
      mergeMode: 'merge',
      rowsPerPage: 50,
      searchQuery: '',
      selectedPlayerId: null
    });
    useWorkspaceStore.setState({
      activeRailSection: 'none',
      graphicsEnabled: true,
      isDiagnosticsOpen: false,
      isFileManagerOpen: false,
      isLdcOpen: false,
      isSettingsOpen: false,
      lastFocusedElement: null
    } as any);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('opens the name column filter on ctrl/cmd+k outside text inputs', () => {
    act(() => {
      root.render(createElement(HookHost));
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'k' }));
    });

    expect(focusNameColumnFilterMock).toHaveBeenCalledTimes(1);
  });

  it('ignores ctrl/cmd+k when focus is already inside a text field', () => {
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();

    act(() => {
      root.render(createElement(HookHost));
    });

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: 'k' }));
    });

    expect(focusNameColumnFilterMock).not.toHaveBeenCalled();
    input.remove();
  });

  it('closes an open column filter on escape', () => {
    isAnyColumnFilterOpenMock.mockReturnValue(true);

    act(() => {
      root.render(createElement(HookHost));
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(closeFiltersMock).toHaveBeenCalledWith({ restoreFocus: true });
  });
});
