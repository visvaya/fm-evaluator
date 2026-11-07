// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { store } from '@/store/tableStore';

import { openLegacyColumnFilter } from './filterLegacyDom';

const CLUB_WITH_QUOTE = `O'Brien "FC"`;

function setupColumn(columnId: string, colType: string) {
  document.body.innerHTML = `
    <table><thead><tr><th data-col-id="${columnId}" data-col-type="${colType}"></th></tr></thead></table>
    <div id="filter-${columnId}" class="filter-popup"></div>
  `;
}

function createActions() {
  return {
    applyFilter: vi.fn(),
    filterCheckboxList: vi.fn(),
    filterClubHasPossession: vi.fn(),
    filterShowOnlyLDCMatched: vi.fn(),
    persistUIState: vi.fn(),
    setFilterArr: vi.fn(),
    setPositionFilterMode: vi.fn(),
    updateFilterCounts: vi.fn()
  };
}

function createDeps(actions = createActions()) {
  return {
    actions,
    getProcessor: () => ({
      calculatedScores: [{ club: 'Legia' }, { club: CLUB_WITH_QUOTE }]
    }),
    setupScrollInput: vi.fn(),
    updateFilterCounts: actions.updateFilterCounts
  };
}

function query<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

function popupOf(columnId: string): HTMLElement {
  return query(document, `#filter-${columnId}`);
}

function pressEnter(element: Element) {
  element.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, key: 'Enter' }));
}

function fire(element: Element, type: string) {
  element.dispatchEvent(new Event(type, { bubbles: true }));
}

function inlineHandlerElements(root: HTMLElement): Element[] {
  return [...root.querySelectorAll('*')].filter((element) =>
    element.getAttributeNames().some((name) => name.startsWith('on'))
  );
}

describe('openLegacyColumnFilter delegated events (strict CSP, no inline handlers)', () => {
  beforeEach(() => {
    store.activeFilters = {};
    store.positionFilterMode = 'or';
  });

  it('renders a complex filter without on* attributes and wires its controls', () => {
    setupColumn('club', 'complex');
    const actions = createActions();

    expect(openLegacyColumnFilter({ columnId: 'club' }, createDeps(actions)).opened).toBe(true);
    const popup = popupOf('club');
    expect(inlineHandlerElements(popup)).toEqual([]);

    const search = query<HTMLInputElement>(popup, 'input[type="text"]');
    search.value = 'leg';
    fire(search, 'input');
    expect(actions.filterCheckboxList).toHaveBeenCalledWith('club', 'leg');
    expect(actions.updateFilterCounts).toHaveBeenCalledWith('club');

    pressEnter(search);
    expect(actions.applyFilter).toHaveBeenCalledWith('club', 'complex');

    fire(query(popup, '#filter-club-has-possession-club'), 'change');
    expect(actions.filterClubHasPossession).toHaveBeenCalledWith('club');

    const quoted = [...popup.querySelectorAll<HTMLInputElement>('#list-club input')].find(
      (input) => input.value === CLUB_WITH_QUOTE
    );
    if (!quoted) throw new Error('Missing checkbox for the quoted club');
    fire(quoted, 'change');
    expect(actions.setFilterArr).toHaveBeenCalledWith('club', CLUB_WITH_QUOTE);
  });

  it('lists choice values in locale order, as the React filter does', () => {
    setupColumn('club', 'complex');
    const deps = {
      ...createDeps(),
      getProcessor: () => ({
        calculatedScores: [{ club: 'Zagłębie' }, { club: 'Śląsk' }, { club: 'Arka' }]
      })
    };

    openLegacyColumnFilter({ columnId: 'club' }, deps);
    const values = [...popupOf('club').querySelectorAll<HTMLInputElement>('#list-club input')].map(
      (input) => input.value
    );

    expect(values).toEqual(['Arka', 'Śląsk', 'Zagłębie']);
  });

  it('wires the LDC matched toggle on the league filter', () => {
    setupColumn('league', 'complex');
    const actions = createActions();
    openLegacyColumnFilter({ columnId: 'league' }, createDeps(actions));

    fire(query(popupOf('league'), '#filter-show-ldc-matched-league'), 'change');

    expect(actions.filterShowOnlyLDCMatched).toHaveBeenCalledWith('league');
  });

  it('switches the position filter mode and persists it', () => {
    setupColumn('position', 'checkbox');
    const actions = createActions();
    openLegacyColumnFilter({ columnId: 'position' }, createDeps(actions));
    const popup = popupOf('position');
    expect(inlineHandlerElements(popup)).toEqual([]);

    fire(query(popup, 'input[name="position-filter-mode"][value="and"]'), 'change');

    expect(actions.setPositionFilterMode).toHaveBeenCalledWith('and');
    expect(actions.persistUIState).toHaveBeenCalledTimes(1);
  });

  it('applies range and search filters on Enter', () => {
    setupColumn('age', 'range');
    const actions = createActions();
    openLegacyColumnFilter({ columnId: 'age' }, createDeps(actions));
    expect(inlineHandlerElements(popupOf('age'))).toEqual([]);
    pressEnter(query(popupOf('age'), '#range-max-age'));
    expect(actions.applyFilter).toHaveBeenCalledWith('age', 'range');

    setupColumn('name', 'search');
    openLegacyColumnFilter({ columnId: 'name' }, createDeps(actions));
    expect(inlineHandlerElements(popupOf('name'))).toEqual([]);
    pressEnter(query(popupOf('name'), '#filter-input-name'));
    expect(actions.applyFilter).toHaveBeenCalledWith('name', 'search');
  });

  it('ignores keys other than Enter', () => {
    setupColumn('name', 'search');
    const actions = createActions();
    openLegacyColumnFilter({ columnId: 'name' }, createDeps(actions));

    query(popupOf('name'), '#filter-input-name').dispatchEvent(
      new KeyboardEvent('keypress', { bubbles: true, key: 'a' })
    );

    expect(actions.applyFilter).not.toHaveBeenCalled();
  });

  it('binds the popup once when the filter is reopened', () => {
    setupColumn('club', 'complex');
    const actions = createActions();
    openLegacyColumnFilter({ columnId: 'club' }, createDeps(actions));
    openLegacyColumnFilter({ columnId: 'club' }, createDeps(actions));

    pressEnter(query(popupOf('club'), 'input[type="text"]'));

    expect(actions.applyFilter).toHaveBeenCalledTimes(1);
  });
});
