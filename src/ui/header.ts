// Header rendering logic extracted from main.js
import { t } from '../lib/i18nBridge';
import { escapeHtmlAttribute } from '../utils/escapeHtmlAttribute';
import type { Column, SortState } from './types';

/**
 * Render table headers
 * @param activeCols Active columns to display
 * @param pinnedColumns List of pinned column IDs
 * @param currentSort Current sort state
 * @param activeFilters Active filters map
 * @param tableHead Table header element
 * @param bindListenersFn Callback to bind event listeners after render
 */
export function renderTableHeaders(
  activeCols: Column[],
  pinnedColumns: string[],
  currentSort: SortState,
  activeFilters: Record<string, any>,
  tableHead: HTMLElement,
  bindListenersFn: () => void
): void {
  // Guard clause: verify tableHead exists
  if (!tableHead) {
    console.error('[renderTableHeaders] tableHead element is null/undefined');
    return;
  }

  let leftOffset = 0;

  const headersHtml = activeCols
    .map((c) => {
      const isPinned = pinnedColumns.includes(c.id);
      const stickyClass = isPinned ? 'sticky-col' : '';
      const fullName = c.fullName || c.name;

      const defaultWidth = c.w ? parseInt(c.w) : calculateColumnWidth(c.name, c.id);
      const savedWidth = c.savedWidth || defaultWidth;
      const columnWidth = savedWidth;

      const sortIndicator =
        currentSort.col === c.id
          ? currentSort.dir === 'asc'
            ? '▲'
            : '▼'
          : ' <span class="invisible">▼</span>';

      const filterActive = activeFilters[c.id] ? 'active' : '';
      const pinActive = isPinned ? 'active pinned' : '';

      return `<th class="p-3 relative group bg-[#EBEBE6] font-black text-[10px] tracking-wider whitespace-nowrap cursor-move ${stickyClass}" 
                data-col-id="${c.id}" 
                data-col-type="${c.type || ''}" 
                draggable="true" 
                width="${columnWidth}">
              <div class="th-content">
                <span class="cursor-pointer hover:text-blue-700 transition" 
                      title="${escapeHtmlAttribute(fullName)}"
                      data-action="sort"
                      data-col-id="${c.id}">${escapeHtmlAttribute(c.name)} ${sortIndicator}</span>
                <div class="flex gap-1 shrink-0">
                  <i class="fas fa-thumbtack text-[10px] action-icon ${pinActive}" 
                     data-action="pin" 
                     data-col-id="${c.id}" 
                     title="${t('pin')}"></i>
                  <i class="fas fa-filter text-[10px] action-icon ${filterActive}" 
                     data-action="filter" 
                     data-col-id="${c.id}" 
                     data-col-type="${c.type || ''}" 
                     title="${t('filter')}"></i>
                </div>
              </div>
              <div class="resize-handle" data-col-id="${c.id}"></div>
              <div id="filter-${c.id}" class="filter-popup"></div>
            </th>`;
    })
    .join('');

  tableHead.innerHTML = headersHtml;

  // Bind event listeners
  bindListenersFn();

  // Calculate and apply sticky positions
  leftOffset = 0;
  activeCols.forEach((c) => {
    if (pinnedColumns.includes(c.id)) {
      const th = tableHead.querySelector(`th[data-col-id="${c.id}"]`);
      if (th instanceof HTMLElement) {
        th.style.left = `${leftOffset}px`;
        th.style.position = 'sticky';
        th.style.backgroundColor = '#EBEBE6';

        const defaultWidth = c.w ? parseInt(c.w) : calculateColumnWidth(c.name, c.id);
        const savedWidth = c.savedWidth || defaultWidth;
        leftOffset += savedWidth;
      }
    }
  });
}

/**
 * Calculate column width based on name length
 */
function calculateColumnWidth(name: string, id: string): number {
  if (id === 'name') return 250;
  if (id === 'club' || id === 'league') return 180;
  if (id === 'suggestion') return 120;

  const charWidth = 8;
  const padding = 24;
  return Math.max(80, Math.min(200, name.length * charWidth + padding));
}
