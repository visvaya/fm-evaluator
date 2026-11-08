// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { store } from '@/store/tableStore';
import { useTableStore } from '@/store/useTableStore';

import { filterClubHasPossession, toggleAllVisible, updateFilterCounts } from './filters';

describe('filters possession seam', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="filter-club-has-possession-club" type="checkbox">
      <div id="list-club">
        <label style="display:flex"><input value="Legia"></label>
        <label style="display:flex"><input value="Lech"></label>
      </div>
      <span id="filter-club-possession-text-club"></span>
    `;

    store.activeFilters = {};
    store.currentPage = 3;
    useTableStore.setState({
      data: [
        { club: 'Legia', name: 'One', uid: '1' },
        { club: 'Lech', name: 'Two', uid: '2' }
      ] as any[]
    });

    (window as any).processor = {
      calculatedScores: [{ club: 'legacy only', uid: 'legacy' }],
      getTeamPossession: (club: string) => (club === 'Legia' ? 55 : null)
    };
    (window as any).persistUIState = vi.fn();
    (window as any).scheduleTableRender = vi.fn();
  });

  it('shows only clubs with assigned possession and updates active filters', () => {
    const checkbox = document.getElementById('filter-club-has-possession-club') as HTMLInputElement;
    checkbox.checked = true;

    filterClubHasPossession('club');

    const visibleLabels = [...document.querySelectorAll('#list-club label')].filter(
      (label) => (label as HTMLElement).style.display !== 'none'
    );

    expect(visibleLabels).toHaveLength(1);
    expect(visibleLabels[0]?.querySelector('input')?.getAttribute('value')).toBe('Legia');
    expect(store.activeFilters.clubHasPossession).toBe(true);
    expect(store.currentPage).toBe(1);
  });

  it('reports possession counts via the shared runtime seam', () => {
    updateFilterCounts('club');

    expect(document.getElementById('filter-club-possession-text-club')?.textContent).toContain(
      '(1)'
    );
  });
});

describe('toggleAllVisible', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="list-club">
        <label style="display:flex"><input type="checkbox" value="Legia"></label>
        <label style="display:flex"><input type="checkbox" value="Lech"></label>
        <label style="display:none"><input type="checkbox" value="Hidden"></label>
      </div>
    `;
    store.activeFilters = { club: ['Hidden'] };
    Object.assign(window, { persistUIState: vi.fn(), scheduleTableRender: vi.fn() });
  });

  it('selects every visible value once and keeps hidden selections', () => {
    toggleAllVisible('club');

    expect(store.activeFilters).toEqual({ club: ['Hidden', 'Legia', 'Lech'] });
  });

  it('clears visible values when all are checked and drops an empty filter', () => {
    store.activeFilters = { club: ['Legia', 'Lech'] };
    document
      .querySelectorAll<HTMLInputElement>('label[style="display:flex"] input')
      .forEach((input) => {
        input.checked = true;
      });

    toggleAllVisible('club');

    expect(store.activeFilters).toEqual({});
  });
});
