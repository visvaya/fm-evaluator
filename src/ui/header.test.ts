// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderTableHeaders } from './header';

import type { Column, SortState } from './types';

function makeColumn(overrides: Partial<Column> = {}): Column {
  return { id: 'name', name: 'Name', ...overrides };
}

describe('header', () => {
  let tableHead: HTMLElement;
  let bindListeners: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.stubGlobal('i18n', { t: (key: string) => key });

    // Use a table>thead structure so jsdom doesn't strip the thead
    document.body.innerHTML = '<table><thead id="table-head"></thead></table>';
    tableHead = document.querySelector('#table-head')!;
    bindListeners = vi.fn<() => void>();
  });

  describe('renderTableHeaders', () => {
    it('should render header cells for each column', () => {
      const cols = [
        makeColumn({ id: 'name', name: 'Name' }),
        makeColumn({ id: 'club', name: 'Club' }),
        makeColumn({ id: 'league', name: 'League' })
      ];
      const sort: SortState = { col: 'name', dir: 'asc' };

      renderTableHeaders(cols, [], sort, {}, tableHead, bindListeners);

      const ths = tableHead.querySelectorAll('th');
      expect(ths).toHaveLength(3);
    });

    it('should show sort indicator for sorted column', () => {
      const cols = [makeColumn({ id: 'name', name: 'Name' })];
      const sort: SortState = { col: 'name', dir: 'asc' };

      renderTableHeaders(cols, [], sort, {}, tableHead, bindListeners);

      expect(tableHead.innerHTML).toContain('▲');
    });

    it('should show descending indicator', () => {
      const cols = [makeColumn({ id: 'name', name: 'Name' })];
      const sort: SortState = { col: 'name', dir: 'desc' };

      renderTableHeaders(cols, [], sort, {}, tableHead, bindListeners);

      expect(tableHead.innerHTML).toContain('▼');
    });

    it('should mark active filter columns', () => {
      const cols = [makeColumn({ id: 'name', name: 'Name' })];
      const sort: SortState = { col: '', dir: 'asc' };
      const filters = { name: { value: 'test' } };

      renderTableHeaders(cols, [], sort, filters, tableHead, bindListeners);

      const filterIcon = tableHead.querySelector('[data-action="filter"]');
      expect(filterIcon?.classList.contains('active')).toBe(true);
    });

    it('should not mark inactive filter columns', () => {
      const cols = [makeColumn({ id: 'name', name: 'Name' })];
      const sort: SortState = { col: '', dir: 'asc' };

      renderTableHeaders(cols, [], sort, {}, tableHead, bindListeners);

      const filterIcon = tableHead.querySelector('[data-action="filter"]');
      expect(filterIcon?.classList.contains('active')).toBe(false);
    });

    it('should mark pinned columns', () => {
      const cols = [makeColumn({ id: 'name', name: 'Name' })];
      const sort: SortState = { col: '', dir: 'asc' };

      renderTableHeaders(cols, ['name'], sort, {}, tableHead, bindListeners);

      const pinIcon = tableHead.querySelector('[data-action="pin"]');
      expect(pinIcon?.classList.contains('pinned')).toBe(true);
    });

    it('should apply sticky positioning to pinned columns', () => {
      const cols = [makeColumn({ id: 'name', name: 'Name', savedWidth: 200 })];
      const sort: SortState = { col: '', dir: 'asc' };

      renderTableHeaders(cols, ['name'], sort, {}, tableHead, bindListeners);

      const th = tableHead.querySelector<HTMLElement>('th[data-col-id="name"]');
      expect(th?.style.position).toBe('sticky');
      expect(th?.style.left).toBe('0px');
    });

    it('should call bindListenersFn after rendering', () => {
      const cols = [makeColumn()];
      const sort: SortState = { col: '', dir: 'asc' };

      renderTableHeaders(cols, [], sort, {}, tableHead, bindListeners);

      expect(bindListeners).toHaveBeenCalledOnce();
    });

    it('should include data-col-id attribute on each th', () => {
      const cols = [
        makeColumn({ id: 'age', name: 'Age' }),
        makeColumn({ id: 'wage', name: 'Wage' })
      ];
      const sort: SortState = { col: '', dir: 'asc' };

      renderTableHeaders(cols, [], sort, {}, tableHead, bindListeners);

      expect(tableHead.querySelector('[data-col-id="age"]')).not.toBeNull();
      expect(tableHead.querySelector('[data-col-id="wage"]')).not.toBeNull();
    });

    it('should include resize handle for each column', () => {
      const cols = [makeColumn({ id: 'name', name: 'Name' })];
      const sort: SortState = { col: '', dir: 'asc' };

      renderTableHeaders(cols, [], sort, {}, tableHead, bindListeners);

      const handle = tableHead.querySelector<HTMLElement>('.resize-handle');
      expect(handle).not.toBeNull();
      expect(handle?.dataset.colId).toBe('name');
    });

    it('should include filter popup placeholder for each column', () => {
      const cols = [makeColumn({ id: 'name', name: 'Name' })];
      const sort: SortState = { col: '', dir: 'asc' };

      renderTableHeaders(cols, [], sort, {}, tableHead, bindListeners);

      const popup = tableHead.querySelector('#filter-name');
      expect(popup).not.toBeNull();
      expect(popup?.classList.contains('filter-popup')).toBe(true);
    });

    it('should not crash when tableHead is null', () => {
      const cols = [makeColumn()];
      const sort: SortState = { col: '', dir: 'asc' };

      expect(() =>
        renderTableHeaders(cols, [], sort, {}, null as any, bindListeners)
      ).not.toThrow();

      expect(bindListeners).not.toHaveBeenCalled();
    });

    it('should include column fullName in title attribute', () => {
      const cols = [makeColumn({ fullName: 'Player Full Name', id: 'name', name: 'Name' })];
      const sort: SortState = { col: '', dir: 'asc' };

      renderTableHeaders(cols, [], sort, {}, tableHead, bindListeners);

      expect(tableHead.innerHTML).toContain('Player Full Name');
    });

    it('should set draggable=true on headers', () => {
      const cols = [makeColumn({ id: 'name', name: 'Name' })];
      const sort: SortState = { col: '', dir: 'asc' };

      renderTableHeaders(cols, [], sort, {}, tableHead, bindListeners);

      const th = tableHead.querySelector('th');
      expect(th?.getAttribute('draggable')).toBe('true');
    });
  });

  it('renders column names as text, not markup', () => {
    const hostile = '<img src=x data-injected="1">';
    const sort: SortState = { col: 'name', dir: 'asc' };

    renderTableHeaders(
      [makeColumn({ fullName: `"${hostile}`, id: 'custom', name: hostile })],
      [],
      sort,
      {},
      tableHead,
      bindListeners
    );

    expect(tableHead.querySelector('[data-injected]')).toBeNull();
    expect(tableHead.querySelector('th')?.textContent).toContain(hostile);
  });
});
