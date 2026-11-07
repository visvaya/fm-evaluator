// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTableStore } from '@/store/useTableStore';
import { store as legacyTableStore } from '@/store/tableStore';

import { ColumnFilterPopover } from './ColumnFilterPopover';

describe('ColumnFilterPopover', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    legacyTableStore.activeFilters = {};
    legacyTableStore.currentPage = 2;
    legacyTableStore.filterDirty = false;
    legacyTableStore.headersDirty = false;
    useTableStore.setState({
      activeFilters: {},
      compatRevision: 0,
      currentPage: 2,
      data: [
        { club: 'Legia', league: 'Ekstraklasa', name: 'Richardson', uid: '1' },
        { club: 'Lech', league: 'Ekstraklasa', name: 'Kowalski', uid: '2' }
      ] as any[]
    });
    window.processor = {
      calculatedScores: [
        { club: 'Legia', league: 'Ekstraklasa', name: 'Richardson', uid: '1' },
        { club: 'Lech', league: 'Ekstraklasa', name: 'Kowalski', uid: '2' }
      ],
      getTeamPossession: (club: string) => (club === 'Legia' ? 55 : null)
    } as any;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('applies search filters from the React popup', () => {
    act(() => {
      root.render(
        createElement(ColumnFilterPopover, { columnId: 'name', isOpen: true, type: 'search' })
      );
    });

    const input = container.querySelector<HTMLInputElement>('#filter-input-name');
    expect(input).not.toBeNull();

    act(() => {
      input!.value = ' Richardson ';
      container.querySelector<HTMLButtonElement>('[data-fm-action="applyFilter"]')?.click();
    });

    expect(legacyTableStore.activeFilters).toEqual({ name: 'richardson' });
    expect(useTableStore.getState().activeFilters).toEqual({ name: 'richardson' });
    expect(useTableStore.getState().currentPage).toBe(1);
  });

  it('renders complex checkbox options and toggles selected values', () => {
    act(() => {
      root.render(
        createElement(ColumnFilterPopover, { columnId: 'club', isOpen: true, type: 'complex' })
      );
    });

    const legiaCheckbox = [
      ...container.querySelectorAll<HTMLInputElement>('#list-club input')
    ].find((input) => input.value === 'Legia');
    expect(legiaCheckbox).not.toBeNull();

    act(() => {
      legiaCheckbox!.click();
    });

    expect(legacyTableStore.activeFilters).toEqual({ club: ['Legia'] });
    expect(useTableStore.getState().activeFilters).toEqual({ club: ['Legia'] });
  });

  it('filters club values by assigned possession through the shared runtime seam', () => {
    act(() => {
      root.render(
        createElement(ColumnFilterPopover, { columnId: 'club', isOpen: true, type: 'complex' })
      );
    });

    const possessionToggle = container.querySelector<HTMLInputElement>(
      '#filter-club-has-possession-club'
    );
    expect(possessionToggle).not.toBeNull();

    act(() => {
      possessionToggle!.click();
    });

    const visibleCheckboxes = [...container.querySelectorAll<HTMLInputElement>('#list-club input')];
    expect(visibleCheckboxes.map((input) => input.value)).toEqual(['Legia']);
    expect(container.textContent).toContain(
      'Pokaż tylko kluby z przypisanym posiadaniem piłki (1)'
    );
  });
});
