/* eslint-disable sonarjs/no-nested-conditional -- Legacy DOM fallback preserves historical popup markup until all callers are React-owned. */
import { COLUMNS } from '../config/columns';
import { translatePosition, translateValue } from '../i18n/translate';
import { store } from '../store/tableStore';
import { escapeHtmlAttribute } from '../utils/escapeHtmlAttribute';

import { bindLegacyFilterPopup } from './filterLegacyEvents';
import { sortPositionsIntelligently } from './filterModel';

import type { LegacyFilterActions } from './filterLegacyEvents';

export interface LegacyColumnFilterRequest {
  anchorEl?: HTMLElement | null;
  columnId: string;
  focusInput?: boolean;
  returnFocusEl?: HTMLElement | null;
  type?: string;
}

export interface LegacyColumnFilterResult {
  opened: boolean;
  returnFocusEl: HTMLElement | null;
}

interface LegacyColumnFilterDeps {
  actions: LegacyFilterActions;
  getProcessor: () => any;
  setupScrollInput: (id: string, step?: number, start?: number) => void;
  updateFilterCounts: (id: string) => void;
}

function resolveFilterContext(columnId: string, explicitType?: string) {
  const th = document.querySelector<HTMLElement>(`th[data-col-id="${columnId}"]`);
  const triggerEl = th?.querySelector<HTMLElement>('[data-filter-trigger="true"]') || null;
  const popup = document.querySelector<HTMLElement>(`#filter-${columnId}`);
  const columnType =
    explicitType ||
    th?.dataset.colType ||
    COLUMNS.find((column) => column.id === columnId)?.type ||
    '';

  return {
    popup,
    th,
    triggerEl,
    type: columnType
  };
}

function getUniqueFilterValues(processor: any, columnId: string): string[] {
  if (columnId === 'position') {
    return sortPositionsIntelligently([
      'GK',
      'D (L)',
      'D (C)',
      'D (R)',
      'WB (L)',
      'WB (R)',
      'DM',
      'M (L)',
      'M (C)',
      'M (R)',
      'AM (L)',
      'AM (C)',
      'AM (R)',
      'ST (C)',
      'Inna/nieznana'
    ]);
  }

  const set = new Set<string>();
  for (const player of processor.calculatedScores) {
    if (player[columnId]) {
      set.add(player[columnId]);
    }
  }
  return [...set].toSorted((left, right) => left.localeCompare(right));
}

function getRangeMaxAttr(columnId: string): string {
  if (columnId === 'leftFootStars' || columnId === 'rightFootStars') {
    return 'max="5"';
  }
  if (['age', 'mins', 'value', 'wage'].includes(columnId)) {
    return '';
  }
  return 'max="20"';
}

function renderChoiceFilter(columnId: string, type: string, uniqueVals: string[]): string {
  const isPos = columnId === 'position';
  const activeCount = store.activeFilters[columnId] ? store.activeFilters[columnId].length : 0;
  let html = '';

  if (type === 'complex') {
    html += `<input type="text" placeholder="Filtruj..." class="input-paper w-full p-1.5 text-xs rounded mb-2" data-fm-filter-input="search-list" data-fm-enter-apply="true">`;
    html += `<button id="toggle-visible-btn-${columnId}" class="text-[10px] bg-gray-200 hover:bg-gray-300 px-2 py-1 mb-2 w-full rounded block" data-fm-action="toggleAllVisible" data-fm-id="${columnId}">Zaznacz/odznacz widoczne</button>`;

    if (columnId === 'league') {
      html += `<div class="mb-2 p-2 bg-gray-50 border border-gray-200 rounded">
                    <label class="flex items-center gap-2 text-xs text-ink cursor-pointer">
                        <input type="checkbox" id="filter-show-ldc-matched-${columnId}" data-fm-filter-change="ldc-matched" class="accent-black">
                        <span id="filter-ldc-matched-text-${columnId}">Pokaż na liście filtra tylko ligi dopasowane w LDC</span>
                    </label>
                </div>`;
      html += `<button id="show-active-btn-${columnId}" class="text-[10px] bg-blue-200 hover:bg-blue-300 px-2 py-1 mb-2 w-full rounded block" data-fm-action="toggleShowActiveInFilter" data-fm-id="${columnId}">Pokaż na liście tylko aktywne (${activeCount})</button>`;
    }

    if (columnId === 'club') {
      html += `<div class="mb-2 p-2 bg-gray-50 border border-gray-200 rounded">
                    <label class="flex items-center gap-2 text-xs text-ink cursor-pointer">
                        <input type="checkbox" id="filter-club-has-possession-${columnId}" data-fm-filter-change="club-possession" class="accent-black">
                        <span id="filter-club-possession-text-${columnId}">Pokaż tylko kluby z przypisanym posiadaniem piłki</span>
                    </label>
                </div>`;
      html += `<button id="show-active-btn-${columnId}" class="text-[10px] bg-blue-200 hover:bg-blue-300 px-2 py-1 mb-2 w-full rounded block" data-fm-action="toggleShowActiveInFilter" data-fm-id="${columnId}">Pokaż na liście tylko aktywne (${activeCount})</button>`;
    }
  }

  if (isPos) {
    html += `<div class="mb-2 p-2 bg-gray-50 border border-gray-200 rounded">
                  <div class="text-[10px] font-bold uppercase text-gray-600 mb-1.5">Logika filtrowania:</div>
                  <div class="flex gap-3">
                      <label class="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
                          <input type="radio" name="position-filter-mode" value="or" ${store.positionFilterMode === 'or' ? 'checked' : ''} data-fm-filter-change="position-mode" class="accent-black">
                          <span>Lub (OR)</span>
                      </label>
                      <label class="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
                          <input type="radio" name="position-filter-mode" value="and" ${store.positionFilterMode === 'and' ? 'checked' : ''} data-fm-filter-change="position-mode" class="accent-black">
                          <span>I (AND)</span>
                      </label>
                  </div>
              </div>`;
  }

  html += `<div class="max-h-32 overflow-y-auto space-y-1" id="list-${columnId}">${uniqueVals
    .map((value) => {
      const translatedValue = isPos ? translatePosition(value) : translateValue(value, columnId);
      return `<label class="flex items-center gap-2 text-xs text-ink hover:bg-gray-100 p-1 cursor-pointer"><input type="checkbox" value="${escapeHtmlAttribute(String(value))}" data-fm-filter-change="value" ${store.activeFilters[columnId]?.includes(value) ? 'checked' : ''} class="accent-black font-mono">${escapeHtmlAttribute(String(translatedValue))}</label>`;
    })
    .join('')}</div>`;

  return html;
}

function renderRangeFilter(columnId: string, type: string, deps: LegacyColumnFilterDeps): string {
  const currentMin = store.activeFilters[columnId]?.min || '';
  const currentMax = store.activeFilters[columnId]?.max || '';
  const colDef = COLUMNS.find((column) => column.id === columnId);
  const isFeet = columnId === 'leftFootStars' || columnId === 'rightFootStars';
  const isScore = columnId === 'attrScore' || columnId === 'statScore' || columnId === 'totalScore';
  const isSpecial = ['age', 'mins', 'value', 'wage'].includes(columnId);
  const step = colDef?.step || (isSpecial || isFeet ? '1' : '0.1');
  const maxAttr = getRangeMaxAttr(columnId);
  const inputWidth = ['mins', 'value', 'wage'].includes(columnId) ? 'w-24' : 'w-16';

  setTimeout(() => {
    deps.setupScrollInput(`range-min-${columnId}`, Number.parseFloat(step), 0);
    let maxStart = 0;
    if (isScore) {
      maxStart = 20;
    } else if (isFeet) {
      maxStart = 5;
    }
    deps.setupScrollInput(`range-max-${columnId}`, Number.parseFloat(step), maxStart);
  }, 0);

  return `<div class="flex gap-2 mb-2">
                <input type="number" id="range-min-${columnId}" value="${currentMin}" placeholder="Min" step="${step}" min="${colDef?.min === undefined ? '0' : colDef.min}" ${maxAttr} class="input-paper ${inputWidth} p-1.5 text-xs rounded" data-fm-enter-apply="true">
                <input type="number" id="range-max-${columnId}" value="${currentMax}" placeholder="Max" step="${step}" min="${colDef?.min === undefined ? '0' : colDef.min}" ${maxAttr} class="input-paper ${inputWidth} p-1.5 text-xs rounded" data-fm-enter-apply="true">
            </div>`;
}

function buildFilterMarkup(
  request: LegacyColumnFilterRequest,
  type: string,
  deps: LegacyColumnFilterDeps
): string {
  const processor = deps.getProcessor();
  let html = '';

  switch (type) {
    case 'checkbox':
    case 'complex': {
      html = renderChoiceFilter(
        request.columnId,
        type,
        getUniqueFilterValues(processor, request.columnId)
      );
      break;
    }
    case 'range': {
      html = renderRangeFilter(request.columnId, type, deps);
      break;
    }
    case 'search': {
      const currentVal = store.activeFilters[request.columnId] || '';
      html = `<input id="filter-input-${request.columnId}" type="text" value="${escapeHtmlAttribute(String(currentVal))}" placeholder="Szukaj..." class="input-paper w-full p-1.5 text-xs rounded mb-2" data-fm-enter-apply="true">`;
      break;
    }
    // No default
  }

  return `${html}
        <div class="flex gap-2 mt-2">
            <button class="flex-1 bg-ink text-white text-xs py-1.5 font-bold uppercase hover:bg-gray-800" data-fm-action="applyFilter" data-fm-id="${request.columnId}" data-fm-type="${type}">Zastosuj</button>
            <button class="bg-gray-200 text-ink text-xs px-3 py-1.5 hover:bg-gray-300" data-fm-action="resetColumnFilter" data-fm-id="${request.columnId}" title="Resetuj filtr"><i class="fas fa-undo"></i></button>
        </div>`;
}

function resetOpenFilterDom(): void {
  document.querySelectorAll('.action-icon.open').forEach((icon) => icon.classList.remove('open'));
  document.querySelectorAll('.filter-popup').forEach((element) => {
    const popupElement = element as HTMLElement;
    popupElement.classList.remove('show', 'left-aligned');
    popupElement.style.left = '';
    popupElement.style.right = '';
    popupElement.style.transform = '';
  });
}

function positionPopupBeforeShow(popup: HTMLElement, th: HTMLElement): void {
  const thRect = th.getBoundingClientRect();
  const estimatedPopupWidth = 244;

  if (thRect.left < 260 || thRect.left + estimatedPopupWidth > window.innerWidth) {
    popup.classList.add('left-aligned');
  }

  if (!popup.classList.contains('left-aligned')) {
    return;
  }

  const viewportWidth = window.innerWidth;
  if (thRect.left < 10) {
    const offset = 10 - thRect.left;
    popup.style.left = `${Math.max(0, offset)}px`;
    popup.style.right = 'auto';
  } else if (thRect.left + estimatedPopupWidth > viewportWidth) {
    const overflow = thRect.left + estimatedPopupWidth - viewportWidth;
    popup.style.left = `${Math.max(0, -overflow + 10)}px`;
    popup.style.right = 'auto';
  } else {
    popup.style.left = '';
    popup.style.right = '';
  }
}

function adjustPopupAfterShow(popup: HTMLElement, th: HTMLElement): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const popupRect = popup.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const thRect = th.getBoundingClientRect();
      let needsAdjustment = false;
      let newLeft: null | number = popup.style.left
        ? Number.parseInt(popup.style.left, 10)
        : popup.classList.contains('left-aligned')
          ? 0
          : null;

      if (popupRect.left < 0) {
        newLeft = 10 - thRect.left;
        needsAdjustment = true;
        popup.style.right = 'auto';
      }

      if (popupRect.right > viewportWidth) {
        const overflow = popupRect.right - viewportWidth;
        const currentLeft = newLeft === null ? 0 : newLeft;
        newLeft = Math.max(0, currentLeft - overflow - 10);
        needsAdjustment = true;
      }

      if (needsAdjustment && newLeft !== null) {
        popup.style.left = `${newLeft}px`;
        popup.style.right = 'auto';
        popup.style.transform = 'none';

        requestAnimationFrame(() => {
          const finalRect = popup.getBoundingClientRect();
          const finalThRect = th.getBoundingClientRect();

          if (finalRect.left < 0) {
            popup.style.left = `${Math.max(0, 10 - finalThRect.left)}px`;
          }
          if (finalRect.right > viewportWidth) {
            const finalOverflow = finalRect.right - viewportWidth;
            const finalCurrentLeft = Number.parseInt(popup.style.left, 10) || 0;
            popup.style.left = `${Math.max(0, finalCurrentLeft - finalOverflow - 10)}px`;
          }
        });
      }
    });
  });
}

export function openLegacyColumnFilter(
  request: LegacyColumnFilterRequest,
  deps: LegacyColumnFilterDeps
): LegacyColumnFilterResult {
  const { popup, th, triggerEl, type } = resolveFilterContext(request.columnId, request.type);
  if (!popup || !th || !type) {
    return { opened: false, returnFocusEl: null };
  }

  resetOpenFilterDom();
  request.anchorEl?.classList.add('open');
  triggerEl?.classList.add('open');

  const returnFocusEl = request.returnFocusEl ?? request.anchorEl ?? triggerEl ?? th;
  popup.innerHTML = buildFilterMarkup(request, type, deps);
  bindLegacyFilterPopup(popup, {
    actions: deps.actions,
    columnId: request.columnId,
    type
  });
  positionPopupBeforeShow(popup, th);
  popup.classList.add('show');
  adjustPopupAfterShow(popup, th);

  if (type === 'complex') {
    setTimeout(() => deps.updateFilterCounts(request.columnId), 0);
  }

  if (request.focusInput) {
    window.setTimeout(() => {
      const input = popup.querySelector<HTMLInputElement>(
        `#filter-input-${request.columnId}, input[type="text"], input[type="number"]`
      );
      input?.focus();
      input?.select();
    }, 0);
  }

  return { opened: true, returnFocusEl };
}
