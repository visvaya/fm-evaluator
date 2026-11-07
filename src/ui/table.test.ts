// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildRowHtml,
  getBadge,
  getDataBadge,
  getValueRatingBadge,
  renderBar,
  renderEmptyState,
  renderPagedRows,
  renderRatioCell,
  renderVirtualRows
} from './table';

import type { Column, Player, VirtualState } from './types';

function makeColumn(overrides: Partial<Column> = {}): Column {
  return { id: 'name', name: 'Name', ...overrides };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    attrScore: 16,
    club: 'Test FC',
    dataCategory: 'Pełne dane',
    hasAnyRange: false,
    league: 'Premier League',
    name: 'Jan Kowalski',
    pos2Array: ['AMC'],
    position: 'MC',
    positionArray: ['MC', 'AMC'],
    shouldItalicizeAttrScore: false,
    shouldItalicizeStatScore: false,
    statScore: 14,
    suggestion: 'Kup',
    totalScore: 15.5,
    uid: 'p001',
    ...overrides
  };
}

describe('table.ts', () => {
  beforeEach(() => {
    vi.stubGlobal('i18n', { t: (key: string) => key });
    vi.stubGlobal('translateValue', (val: string) => val);
    vi.stubGlobal('translatePosition', (pos: string) => pos);
    // Mock document.getElementById for renderCellContent (position-select)
    document.body.innerHTML = '';
  });

  // -----------------------------------------------------------------------
  // renderBar
  // -----------------------------------------------------------------------

  describe('renderBar', () => {
    it('should render a bar for numeric value', () => {
      const html = renderBar(15);
      expect(html).toContain('15.0');
      expect(html).toContain('width:75%');
    });

    it('should render 0% for value 0', () => {
      const html = renderBar(0);
      expect(html).toContain('0.0');
      expect(html).toContain('width:0%');
    });

    it('should cap width at 100% for value 20', () => {
      const html = renderBar(20);
      expect(html).toContain('width:100%');
    });

    it('should use red color for low scores (<50%)', () => {
      const html = renderBar(5); // 25%
      expect(html).toContain('#ef4444');
    });

    it('should use yellow color for mid scores (50-75%)', () => {
      const html = renderBar(12); // 60%
      expect(html).toContain('#eab308');
    });

    it('should use green color for high scores (>=75%)', () => {
      const html = renderBar(16); // 80%
      expect(html).toContain('#22c55e');
    });

    it('should add italic class when isRange is true', () => {
      const html = renderBar(10, true);
      expect(html).toContain('italic');
    });

    it('should not add italic class when isRange is false', () => {
      const html = renderBar(10, false);
      expect(html).not.toContain('italic');
    });

    it('should return dash for null value', () => {
      const html = renderBar(null);
      expect(html).toContain('-');
    });

    it('should return dash for undefined value', () => {
      const html = renderBar();
      expect(html).toContain('-');
    });

    it('should return the value string for non-number', () => {
      const html = renderBar('N/A' as any);
      expect(html).toContain('N/A');
    });
  });

  // -----------------------------------------------------------------------
  // getBadge
  // -----------------------------------------------------------------------

  describe('getBadge', () => {
    it('should return dash for null', () => {
      expect(getBadge(null)).toBe('-');
    });

    it('should return dash for undefined', () => {
      expect(getBadge()).toBe('-');
    });

    it('should render Kup badge with green style', () => {
      const html = getBadge('Kup');
      expect(html).toContain('bg-green-600');
      expect(html).toContain('Kup');
    });

    it('should render Scoutuj badge with blue style', () => {
      const html = getBadge('Scoutuj');
      expect(html).toContain('bg-blue-600');
    });

    it('should render Śledź badge with yellow style', () => {
      const html = getBadge('Śledź');
      expect(html).toContain('bg-yellow-400');
    });

    it('should render Pomiń badge with gray style', () => {
      const html = getBadge('Pomiń');
      expect(html).toContain('bg-gray-200');
    });

    it('should include explanation in title attribute', () => {
      const html = getBadge('Kup');
      expect(html).toContain('title=');
      expect(html).toContain('Rekomendacja');
    });

    it('should handle unknown badge type gracefully', () => {
      const html = getBadge('Unknown');
      expect(html).toContain('Unknown');
      expect(html).toContain('bg-gray-200');
    });
  });

  // -----------------------------------------------------------------------
  // getDataBadge
  // -----------------------------------------------------------------------

  describe('getDataBadge', () => {
    it('should return dash for null', () => {
      expect(getDataBadge(null)).toBe('-');
    });

    it('should render Pełne dane with green class', () => {
      const html = getDataBadge('Pełne dane');
      expect(html).toContain('text-green-600');
    });

    it('should render Brak danych with gray italic', () => {
      const html = getDataBadge('Brak danych');
      expect(html).toContain('text-gray-400');
      expect(html).toContain('italic');
    });

    it('should include explanation in title', () => {
      const html = getDataBadge('Pełne dane');
      expect(html).toContain('title=');
    });

    it('should handle unknown category gracefully', () => {
      const html = getDataBadge('Custom');
      expect(html).toContain('Custom');
      expect(html).toContain('text-gray-500');
    });
  });

  // -----------------------------------------------------------------------
  // getValueRatingBadge
  // -----------------------------------------------------------------------

  describe('getValueRatingBadge', () => {
    it('should return empty for null', () => {
      expect(getValueRatingBadge(null)).toBe('');
    });

    it('should return empty for "fair"', () => {
      expect(getValueRatingBadge('fair')).toBe('');
    });

    it('should render green badge for "niedoceniony"', () => {
      const html = getValueRatingBadge('niedoceniony');
      expect(html).toContain('bg-green-600');
      expect(html).toContain('↓');
    });

    it('should render red badge for "przeceniony"', () => {
      const html = getValueRatingBadge('przeceniony');
      expect(html).toContain('bg-red-600');
      expect(html).toContain('↑');
    });
  });

  // -----------------------------------------------------------------------
  // renderRatioCell
  // -----------------------------------------------------------------------

  describe('renderRatioCell', () => {
    it('should render warning icon when ratio is null', () => {
      const html = renderRatioCell(null, null);
      expect(html).toContain('fa-exclamation-triangle');
    });

    it('should use custom tooltip when ratio is null', () => {
      const html = renderRatioCell(null, null, 'Custom tooltip');
      expect(html).toContain('Custom tooltip');
    });

    it('should render ratio value with x suffix', () => {
      const html = renderRatioCell(1.5, null);
      expect(html).toContain('1.50x');
    });

    it('should use green for high ratio (>=1.2)', () => {
      const html = renderRatioCell(1.3, null);
      expect(html).toContain('text-green-600');
    });

    it('should use red for low ratio (<=0.8)', () => {
      const html = renderRatioCell(0.7, null);
      expect(html).toContain('text-red-600');
    });

    it('should use default color for normal ratio', () => {
      const html = renderRatioCell(1, null);
      expect(html).toContain('text-ink');
      expect(html).not.toContain('text-green-600');
      expect(html).not.toContain('text-red-600');
    });

    it('should include value rating badge when provided', () => {
      const html = renderRatioCell(1.5, 'niedoceniony');
      expect(html).toContain('bg-green-600');
    });
  });

  // -----------------------------------------------------------------------
  // buildRowHtml
  // -----------------------------------------------------------------------

  describe('buildRowHtml', () => {
    it('should render a table row with correct background for even index', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'club', name: 'Club' })],
        pinnedColumns: [],
        player: makePlayer(),
        rowIndex: 0
      });
      expect(html).toContain('<tr');
      expect(html).toContain('bg-white');
    });

    it('should render alternate background for odd index', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'club', name: 'Club' })],
        pinnedColumns: [],
        player: makePlayer(),
        rowIndex: 1
      });
      expect(html).toContain('bg-[#FAFAFA]');
    });

    it('should render suggestion column with badge', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'suggestion', name: 'Suggestion' })],
        pinnedColumns: [],
        player: makePlayer({ suggestion: 'Kup' }),
        rowIndex: 0
      });
      expect(html).toContain('bg-green-600');
      expect(html).toContain('Kup');
    });

    it('should render name column with uid and actions', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'name', name: 'Name' })],
        pinnedColumns: [],
        player: makePlayer({ name: 'Test Player', uid: 'abc123' }),
        rowIndex: 0
      });
      expect(html).toContain('Test Player');
      expect(html).toContain('abc123');
      expect(html).toContain('fa-eye');
      expect(html).toContain('fa-copy');
    });

    it('should apply sticky class to pinned columns', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'name', name: 'Name' })],
        pinnedColumns: ['name'],
        player: makePlayer(),
        rowIndex: 0
      });
      expect(html).toContain('sticky-col');
      expect(html).toContain('position:sticky');
    });

    it('should not apply sticky class to unpinned columns', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'club', name: 'Club' })],
        pinnedColumns: [],
        player: makePlayer(),
        rowIndex: 0
      });
      expect(html).not.toContain('sticky-col');
    });

    it('should render multiple columns', () => {
      const html = buildRowHtml({
        columns: [
          makeColumn({ id: 'suggestion', name: 'Sug' }),
          makeColumn({ id: 'club', name: 'Club' }),
          makeColumn({ id: 'league', name: 'League' })
        ],
        pinnedColumns: [],
        player: makePlayer(),
        rowIndex: 0
      });
      // Should have 3 <td> elements
      const tdCount = (html.match(/<td /g) || []).length;
      expect(tdCount).toBe(3);
    });

    it('should render foot stars with yellow styling', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'leftFootStars', name: 'Left Foot' })],
        pinnedColumns: [],
        player: makePlayer({ leftFootStars: '★★★' }),
        rowIndex: 0
      });
      expect(html).toContain('text-yellow-500');
      expect(html).toContain('★★★');
    });

    it('should render default column with text content', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'age', name: 'Age' })],
        pinnedColumns: [],
        player: makePlayer({ age: '25' }),
        rowIndex: 0
      });
      expect(html).toContain('25');
    });

    it('should render dash for missing default column value', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'nonexistent', name: 'Missing' })],
        pinnedColumns: [],
        player: makePlayer(),
        rowIndex: 0
      });
      expect(html).toContain('-');
    });
  });

  // -----------------------------------------------------------------------
  // renderEmptyState
  // -----------------------------------------------------------------------

  describe('renderEmptyState', () => {
    it('should render a row spanning all columns', () => {
      const cols = [makeColumn(), makeColumn({ id: 'club' }), makeColumn({ id: 'league' })];
      const html = renderEmptyState(cols);
      expect(html).toContain('colspan="3"');
    });

    it('should use colspan 1 for empty columns', () => {
      const html = renderEmptyState([]);
      expect(html).toContain('colspan="1"');
    });

    it('should contain the no_data_filters translation key', () => {
      const html = renderEmptyState([makeColumn()]);
      expect(html).toContain('no_data_filters');
    });
  });

  // -----------------------------------------------------------------------
  // renderPagedRows
  // -----------------------------------------------------------------------

  describe('renderPagedRows', () => {
    function setupTableBody(): HTMLElement {
      // jsdom strips <tbody> outside <table>, so wrap properly
      document.body.innerHTML = '<table><tbody id="tb"></tbody></table>';
      return document.querySelector('#tb');
    }

    const cols = [makeColumn({ id: 'club', name: 'Club' })];
    const players = Array.from({ length: 12 }, (_, i) =>
      makePlayer({ club: `Club ${i}`, name: `Player ${i}`, uid: `p${i}` })
    );

    it('should render empty state when sorted array is empty', () => {
      const tb = setupTableBody();
      const updateFn = vi.fn();

      renderPagedRows([], cols, [], 1, 10, tb, updateFn);

      expect(tb.innerHTML).toContain('no_data_filters');
      expect(updateFn).toHaveBeenCalledWith(0, 0);
    });

    it('should render correct number of rows for first page', () => {
      const tb = setupTableBody();
      const updateFn = vi.fn();

      renderPagedRows(players, cols, [], 1, 5, tb, updateFn);

      const rows = tb.querySelectorAll('tr');
      expect(rows).toHaveLength(5);
      expect(updateFn).toHaveBeenCalledWith(1, 3); // 12 players / 5 per page = 3 pages
    });

    it('should render correct rows for second page', () => {
      const tb = setupTableBody();
      const updateFn = vi.fn();

      renderPagedRows(players, cols, [], 2, 5, tb, updateFn);

      const rows = tb.querySelectorAll('tr');
      expect(rows).toHaveLength(5);
      // Second page should have Player 5-9
      expect(tb.innerHTML).toContain('Club 5');
      expect(tb.innerHTML).not.toContain('Club 0');
      expect(updateFn).toHaveBeenCalledWith(2, 3);
    });

    it('should render remaining rows on last page', () => {
      const tb = setupTableBody();
      const updateFn = vi.fn();

      renderPagedRows(players, cols, [], 3, 5, tb, updateFn);

      const rows = tb.querySelectorAll('tr');
      expect(rows).toHaveLength(2); // 12 - 10 = 2 remaining
      expect(tb.innerHTML).toContain('Club 10');
      expect(tb.innerHTML).toContain('Club 11');
    });

    it('should clamp page number that exceeds maxPage', () => {
      const tb = setupTableBody();
      const updateFn = vi.fn();

      renderPagedRows(players, cols, [], 99, 5, tb, updateFn);

      // Should clamp to last page (3)
      expect(updateFn).toHaveBeenCalledWith(3, 3);
      const rows = tb.querySelectorAll('tr');
      expect(rows).toHaveLength(2);
    });

    it('should clamp page number 0 to page 1', () => {
      const tb = setupTableBody();
      const updateFn = vi.fn();

      renderPagedRows(players, cols, [], 0, 5, tb, updateFn);

      expect(updateFn).toHaveBeenCalledWith(1, 3);
    });

    it('should handle single-page dataset', () => {
      const tb = setupTableBody();
      const updateFn = vi.fn();
      const small = players.slice(0, 3);

      renderPagedRows(small, cols, [], 1, 10, tb, updateFn);

      const rows = tb.querySelectorAll('tr');
      expect(rows).toHaveLength(3);
      expect(updateFn).toHaveBeenCalledWith(1, 1);
    });

    it('should handle rowsPerPage equal to total rows', () => {
      const tb = setupTableBody();
      const updateFn = vi.fn();

      renderPagedRows(players, cols, [], 1, 12, tb, updateFn);

      const rows = tb.querySelectorAll('tr');
      expect(rows).toHaveLength(12);
      expect(updateFn).toHaveBeenCalledWith(1, 1);
    });
  });

  // -----------------------------------------------------------------------
  // renderVirtualRows
  // -----------------------------------------------------------------------

  describe('renderVirtualRows', () => {
    function setupTableBody(): HTMLElement {
      document.body.innerHTML = '<table><tbody id="tb"></tbody></table>';
      return document.querySelector('#tb');
    }

    const cols = [makeColumn({ id: 'club', name: 'Club' })];
    const players = Array.from({ length: 50 }, (_, i) =>
      makePlayer({ club: `Club ${i}`, name: `Player ${i}`, uid: `p${i}` })
    );
    const ROW_HEIGHT = 40;

    it('should render empty state when sorted array is empty', () => {
      const tb = setupTableBody();
      const vs: VirtualState = { enabled: true, end: 20, start: 0, total: 0 };

      renderVirtualRows([], cols, [], vs, ROW_HEIGHT, tb);

      expect(tb.innerHTML).toContain('no_data_filters');
    });

    it('should render rows within virtual window', () => {
      const tb = setupTableBody();
      const vs: VirtualState = { enabled: true, end: 10, start: 0, total: 50 };

      renderVirtualRows(players, cols, [], vs, ROW_HEIGHT, tb);

      // Should have: spacer-top + 10 data rows + spacer-bottom
      const allRows = tb.querySelectorAll('tr');
      const spacerRows = tb.querySelectorAll('tr.virtual-spacer');
      const dataRows = allRows.length - spacerRows.length;

      expect(spacerRows).toHaveLength(2);
      expect(dataRows).toBe(10);
    });

    it('should render correct top spacer height', () => {
      const tb = setupTableBody();
      const vs: VirtualState = { enabled: true, end: 20, start: 10, total: 50 };

      renderVirtualRows(players, cols, [], vs, ROW_HEIGHT, tb);

      const topSpacer = tb.querySelector('tr.virtual-spacer td');
      // 10 rows before * 40px = 400px
      expect(topSpacer?.getAttribute('style')).toContain('height:400px');
    });

    it('should render correct bottom spacer height', () => {
      const tb = setupTableBody();
      const vs: VirtualState = { enabled: true, end: 20, start: 10, total: 50 };

      renderVirtualRows(players, cols, [], vs, ROW_HEIGHT, tb);

      const spacers = tb.querySelectorAll('tr.virtual-spacer td');
      const bottomSpacer = spacers[1];
      // 30 rows after (50-20) * 40px = 1200px
      expect(bottomSpacer?.getAttribute('style')).toContain('height:1200px');
    });

    it('should have 0px top spacer when starting from row 0', () => {
      const tb = setupTableBody();
      const vs: VirtualState = { enabled: true, end: 10, start: 0, total: 50 };

      renderVirtualRows(players, cols, [], vs, ROW_HEIGHT, tb);

      const topSpacer = tb.querySelector('tr.virtual-spacer td');
      expect(topSpacer?.getAttribute('style')).toContain('height:0px');
    });

    it('should have 0px bottom spacer when rendering to the end', () => {
      const tb = setupTableBody();
      const vs: VirtualState = { enabled: true, end: 50, start: 40, total: 50 };

      renderVirtualRows(players, cols, [], vs, ROW_HEIGHT, tb);

      const spacers = tb.querySelectorAll('tr.virtual-spacer td');
      const bottomSpacer = spacers[1];
      expect(bottomSpacer?.getAttribute('style')).toContain('height:0px');
    });

    it('should clamp end to sortedRows length', () => {
      const tb = setupTableBody();
      // end exceeds array length
      const vs: VirtualState = { enabled: true, end: 100, start: 45, total: 50 };

      renderVirtualRows(players, cols, [], vs, ROW_HEIGHT, tb);

      const allRows = tb.querySelectorAll('tr');
      const spacerRows = tb.querySelectorAll('tr.virtual-spacer');
      const dataRows = allRows.length - spacerRows.length;

      expect(dataRows).toBe(5); // only 45-50
    });

    it('should set colspan on spacer cells', () => {
      const tb = setupTableBody();
      const multiCols = [
        makeColumn({ id: 'club', name: 'Club' }),
        makeColumn({ id: 'league', name: 'League' }),
        makeColumn({ id: 'name', name: 'Name' })
      ];
      const vs: VirtualState = { enabled: true, end: 5, start: 0, total: 10 };

      renderVirtualRows(players.slice(0, 10), multiCols, [], vs, ROW_HEIGHT, tb);

      const spacerTd = tb.querySelector('tr.virtual-spacer td');
      expect(spacerTd?.getAttribute('colspan')).toBe('3');
    });
  });

  // -----------------------------------------------------------------------
  // buildRowHtml – additional column types
  // -----------------------------------------------------------------------

  describe('buildRowHtml – bestRole columns', () => {
    it('should render bestRoleTotal with score and role', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'bestRoleTotal', name: 'Best Role' })],
        pinnedColumns: [],
        player: makePlayer({ bestRoleTotal: { role: 'Advanced Playmaker', score: 14.5 } }),
        rowIndex: 0
      });
      expect(html).toContain('14.5');
      expect(html).toContain('Advanced Playmaker');
    });

    it('should render dash for missing bestRoleTotal', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'bestRoleTotal', name: 'Best Role' })],
        pinnedColumns: [],
        player: makePlayer({ bestRoleTotal: null }),
        rowIndex: 0
      });
      expect(html).toContain('-');
    });

    it('should render bestRoleStat column', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'bestRoleStat', name: 'Best Stat Role' })],
        pinnedColumns: [],
        player: makePlayer({ bestRoleStat: { role: 'Mezzala', score: 12.3 } }),
        rowIndex: 0
      });
      expect(html).toContain('12.3');
      expect(html).toContain('Mezzala');
    });

    it('should render bestRoleAttr column', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'bestRoleAttr', name: 'Best Attr Role' })],
        pinnedColumns: [],
        player: makePlayer({ bestRoleAttr: { role: 'Ball-Winning Midfielder', score: 16.8 } }),
        rowIndex: 0
      });
      expect(html).toContain('16.8');
      expect(html).toContain('Ball-Winning Midfielder');
    });

    it('should truncate long role names with ellipsis', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'bestRoleTotal', name: 'Best Role' })],
        pinnedColumns: [],
        player: makePlayer({
          bestRoleTotal: { role: 'Very Long Role Name That Exceeds Maximum', score: 10 }
        }),
        rowIndex: 0
      });
      expect(html).toContain('title=');
      // Full text should be in title attribute
      expect(html).toContain('Very Long Role Name That Exceeds Maximum');
    });
  });

  describe('buildRowHtml – ratio columns', () => {
    it('should render scorePerValue column', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'scorePerValue', name: 'xVal' })],
        pinnedColumns: [],
        player: makePlayer({ scorePerValue: 1.35, valueRating: 'niedoceniony' }),
        rowIndex: 0
      });
      expect(html).toContain('1.35x');
      expect(html).toContain('bg-green-600');
    });

    it('should render scorePerWage column', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'scorePerWage', name: 'xWage' })],
        pinnedColumns: [],
        player: makePlayer({ scorePerWage: 0.65, wageRating: 'przeceniony' }),
        rowIndex: 0
      });
      expect(html).toContain('0.65x');
      expect(html).toContain('bg-red-600');
    });

    it('should render scorePerValueStat with null ratio', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'scorePerValueStat', name: 'xVal Stat' })],
        pinnedColumns: [],
        player: makePlayer({ scorePerValueStat: null }),
        rowIndex: 0
      });
      expect(html).toContain('fa-exclamation-triangle');
    });

    it('should render scorePerWageStat column', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'scorePerWageStat', name: 'xWage Stat' })],
        pinnedColumns: [],
        player: makePlayer({ scorePerWageStat: 1.1 }),
        rowIndex: 0
      });
      expect(html).toContain('1.10x');
    });

    it('should render scorePerValueAtr column', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'scorePerValueAtr', name: 'xVal Atr' })],
        pinnedColumns: [],
        player: makePlayer({ scorePerValueAtr: null }),
        rowIndex: 0
      });
      expect(html).toContain('fa-exclamation-triangle');
    });

    it('should render scorePerWageAtr column', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'scorePerWageAtr', name: 'xWage Atr' })],
        pinnedColumns: [],
        player: makePlayer({ scorePerWageAtr: 0.95 }),
        rowIndex: 0
      });
      expect(html).toContain('0.95x');
    });
  });

  describe('buildRowHtml – BEST mode score columns', () => {
    it('should render totalScore with role in BEST mode', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'totalScore', name: 'Total' })],
        isBestModeActive: true,
        pinnedColumns: [],
        player: makePlayer({
          bestRole: { role: 'Deep-Lying Playmaker', totalRole: 'DLP' },
          totalScore: 15.5
        }),
        rowIndex: 0
      });

      // In BEST mode with bestRole, should show score with role name
      expect(html).toContain('15.5');
      expect(html).toContain('Deep-Lying Playmaker');
    });

    it('should render totalScore as bar in non-BEST mode', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'totalScore', name: 'Total' })],
        isBestModeActive: false,
        pinnedColumns: [],
        player: makePlayer({ hasAnyRange: false, totalScore: 15.5 }),
        rowIndex: 0
      });

      // In non-BEST mode, renders as a bar
      expect(html).toContain('15.5');
      expect(html).toContain('width:');
    });

    it('should render position column with nominal and secondary positions', () => {
      document.body.innerHTML = '<table><tbody></tbody></table>';

      const html = buildRowHtml({
        columns: [makeColumn({ id: 'position', name: 'Pos' })],
        pinnedColumns: [],
        player: makePlayer({
          pos2Array: ['DM'],
          position: 'MC, AMC',
          positionArray: ['MC', 'AMC', 'DM']
        }),
        rowIndex: 0
      });

      // Nominal positions (positionArray minus pos2Array)
      expect(html).toContain('MC');
      expect(html).toContain('AMC');
      // Secondary should be shown in smaller text
      expect(html).toContain('DM');
    });
  });

  describe('buildRowHtml – rightFootStars', () => {
    it('should render rightFootStars with yellow styling', () => {
      const html = buildRowHtml({
        columns: [makeColumn({ id: 'rightFootStars', name: 'Right Foot' })],
        pinnedColumns: [],
        player: makePlayer({ rightFootStars: '★★★★' }),
        rowIndex: 0
      });
      expect(html).toContain('text-yellow-500');
      expect(html).toContain('★★★★');
    });
  });

  describe('buildRowHtml – imported text', () => {
    const hostile = '<img src=x data-injected="1">';

    it('renders player fields as text, not markup', () => {
      const name = `O'Brien "${hostile}"`;
      const html = buildRowHtml({
        columns: [
          makeColumn({ id: 'name', name: 'Name' }),
          makeColumn({ id: 'club', name: 'Club' }),
          makeColumn({ id: 'league', name: 'League' }),
          makeColumn({ id: 'position', name: 'Position' }),
          makeColumn({ id: 'nationality', name: 'Nationality' })
        ],
        pinnedColumns: [],
        player: makePlayer({
          club: hostile,
          league: hostile,
          name,
          nationality: hostile,
          pos2Array: [hostile],
          positionArray: [hostile],
          uid: hostile
        }),
        rowIndex: 0
      });
      document.body.innerHTML = `<table><tbody>${html}</tbody></table>`;

      expect(document.querySelector('[data-injected]')).toBeNull();
      const cells = [...document.querySelectorAll('td')].map((td) => td.textContent ?? '');
      expect(cells[0]).toContain(name);
      expect(cells[1]).toContain(hostile);
      expect(cells[2]).toContain(hostile);
      expect(cells[3]).toContain(hostile);
      expect(cells[4]).toContain(hostile);
      expect(
        document.querySelector<HTMLElement>('[data-fm-action="copyToClipboard"]')?.dataset.fmText
      ).toBe(name);
    });
  });
});
