/* eslint-disable sonarjs/deprecation -- Compatibility facade for legacy inline filter handlers and DOM-owned fallback state. */
// Phase 5B: Filter logic
// Migrated from main.js L11549-12478

import { loadLeagueMappings } from '../computing/ldcMappings';
import { normalizeLeagueNameForGrouping } from '../computing/ldcUtils';
import { getFilterRuntime } from '../lib/filterRuntime';
import { getProcessor } from '../lib/processorBridge';
import { persistUIState } from '../lib/uiBridge';
import { markFiltersDirty, markHeadersDirty, store } from '../store/tableStore';
import { useTableStore } from '../store/useTableStore';
import { normalizeDiacritics } from '../utils/helpers';

import { getColumnFilterController } from './filterController';
import { openLegacyColumnFilter } from './filterLegacyDom';
import { sortPositionsIntelligently as sortPositionsByModel } from './filterModel';
import { scheduleTableRender } from './tableOrchestrator';

const getLdcSettings = () => (window as any).LDC_SETTINGS;
let lastColumnFilterReturnFocusEl: HTMLElement | null = null;

export function applyFilter(id: string, type: string): void {
  const tableStore = useTableStore.getState();
  if (type === 'search') {
    const val = (document.getElementById(`filter-input-${id}`) as HTMLInputElement)?.value;
    tableStore.applyColumnFilter(id, type, { search: val ?? '' });
  } else if (type === 'range') {
    const min = (document.getElementById(`range-min-${id}`) as HTMLInputElement)?.value;
    const max = (document.getElementById(`range-max-${id}`) as HTMLInputElement)?.value;
    tableStore.applyColumnFilter(id, type, { max: max ?? '', min: min ?? '' });
  } else {
    markFiltersDirty();
    markHeadersDirty();
    store.currentPage = 1;
    persistUIState();
    scheduleTableRender();
  }
  closeFilters();
}

export function bindFilterClickAway(): void {
  window.addEventListener('click', (e) => {
    if (
      !(e.target as HTMLElement).closest('.filter-popup') &&
      !(e.target as HTMLElement).closest('.action-icon')
    ) {
      closeFilters();
    }
  });
}

export function isAnyColumnFilterOpen(): boolean {
  const controller = getColumnFilterController();
  if (controller?.isOpen()) {
    return true;
  }
  return document.querySelectorAll('.filter-popup.show').length > 0;
}

export function closeFilters(options: { restoreFocus?: boolean } = {}): void {
  getColumnFilterController()?.close(options);
  const popups = document.querySelectorAll('.filter-popup.show');
  if (popups.length > 0) {
    popups.forEach((p) => p.classList.remove('show'));
  }
  document.querySelectorAll('.action-icon.open').forEach((icon) => {
    icon.classList.remove('open');
  });

  if (options.restoreFocus && lastColumnFilterReturnFocusEl) {
    try {
      lastColumnFilterReturnFocusEl.focus();
    } catch {
      // Ignore focus failures for detached nodes.
    }
  }

  if (options.restoreFocus) {
    lastColumnFilterReturnFocusEl = null;
  }
}

export function copyToClipboard(e: Event, text: string, iconId: string): void {
  e.stopPropagation();
  const icon = document.getElementById(iconId);
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.append(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    if (icon) {
      const originalClass = icon.className;
      icon.className = 'fas fa-check text-green-600 ml-2 mt-1';
      setTimeout(() => {
        icon.className = originalClass;
      }, 1500);
    }
  } catch (error) {
    console.error('Failed to copy', error);
  }
  textarea.remove();
}

export function filterCheckboxList(id: string, text: string): void {
  const list = document.getElementById(`list-${id}`);
  if (!list) return;
  const labels = list.querySelectorAll('label');
  const query = normalizeDiacritics(text.toLowerCase());
  labels.forEach((label) => {
    const val = normalizeDiacritics(label.textContent.trim().toLowerCase());
    (label as HTMLElement).style.display = val.includes(query) ? 'flex' : 'none';
  });
  updateFilterCounts(id);
}

export function filterClubHasPossession(id: string): void {
  if (id !== 'club') return;
  const filterRuntime = getFilterRuntime();
  const checkbox = document.getElementById(
    `filter-club-has-possession-${id}`
  ) as HTMLInputElement | null;
  if (!checkbox) return;
  const list = document.getElementById(`list-${id}`);
  if (!list) return;
  const labels = list.querySelectorAll('label');
  const showOnly = checkbox.checked;

  labels.forEach((label) => {
    const input = label.querySelector('input');
    if (!input) return;
    const clubName = input.value;

    const possession = filterRuntime.getTeamPossession(clubName);
    const hasPossession = possession !== null && possession !== undefined;

    if (showOnly) {
      (label as HTMLElement).style.display = hasPossession ? 'flex' : 'none';
    } else {
      (label as HTMLElement).style.display = 'flex';
    }
  });

  if (showOnly) {
    store.activeFilters.clubHasPossession = true;
  } else {
    delete store.activeFilters.clubHasPossession;
  }

  updateFilterCounts(id);

  markFiltersDirty();
  store.currentPage = 1;
  persistUIState();
  scheduleTableRender();
}

export function filterLDCMatchedLeagues(id: string): void {
  if (id !== 'league') return;
  const checkbox = document.getElementById(`filter-ldc-matched-${id}`) as HTMLInputElement | null;
  if (!checkbox) return;
  const list = document.getElementById(`list-${id}`);
  if (!list) return;
  const labels = list.querySelectorAll('label');
  const isChecked = checkbox.checked;
  const LDC_SETTINGS = getLdcSettings();

  const ldcLeagueNames = new Set<string>();
  if (LDC_SETTINGS?.leagues) {
    LDC_SETTINGS.leagues.forEach((league: any) => {
      ldcLeagueNames.add(league.name);
      const normalized = normalizeLeagueNameForGrouping(league.name);
      if (normalized !== league.name) {
        ldcLeagueNames.add(normalized);
      }
    });
  }

  const mappings = loadLeagueMappings();

  labels.forEach((label) => {
    const input = label.querySelector('input');
    if (!input) return;
    const leagueName = input.value;
    const normalized = normalizeLeagueNameForGrouping(leagueName);

    const isMatched =
      ldcLeagueNames.has(leagueName) ||
      ldcLeagueNames.has(normalized) ||
      mappings[leagueName] !== undefined ||
      mappings[normalized] !== undefined;

    if (isMatched) {
      input.checked = isChecked;
      if (!store.activeFilters[id]) store.activeFilters[id] = [];
      if (isChecked) {
        if (!store.activeFilters[id].includes(leagueName)) store.activeFilters[id].push(leagueName);
      } else {
        const idx = store.activeFilters[id].indexOf(leagueName);
        if (idx !== -1) store.activeFilters[id].splice(idx, 1);
      }
    }
  });

  if (store.activeFilters[id]?.length === 0) delete store.activeFilters[id];
}

export function filterShowOnlyLDCMatched(id: string): void {
  if (id !== 'league') return;
  const checkbox = document.getElementById(
    `filter-show-ldc-matched-${id}`
  ) as HTMLInputElement | null;
  if (!checkbox) return;
  const list = document.getElementById(`list-${id}`);
  if (!list) return;
  const labels = list.querySelectorAll('label');
  const showOnly = checkbox.checked;
  const LDC_SETTINGS = getLdcSettings();

  const ldcLeagueNames = new Set<string>();
  if (LDC_SETTINGS?.leagues) {
    LDC_SETTINGS.leagues.forEach((league: any) => {
      ldcLeagueNames.add(league.name);
      const normalized = normalizeLeagueNameForGrouping(league.name);
      if (normalized !== league.name) {
        ldcLeagueNames.add(normalized);
      }
    });
  }

  const mappings = loadLeagueMappings();

  labels.forEach((label) => {
    const input = label.querySelector('input');
    if (!input) return;
    const leagueName = input.value;
    const normalized = normalizeLeagueNameForGrouping(leagueName);

    const isMatched =
      ldcLeagueNames.has(leagueName) ||
      ldcLeagueNames.has(normalized) ||
      mappings[leagueName] !== undefined ||
      mappings[normalized] !== undefined;

    if (showOnly) {
      (label as HTMLElement).style.display = isMatched ? 'flex' : 'none';
    } else {
      (label as HTMLElement).style.display = 'flex';
    }
  });

  updateFilterCounts(id);
}

function resolveFilterContext(columnId: string) {
  const th = document.querySelector<HTMLElement>(`th[data-col-id="${columnId}"]`);
  const triggerEl = th?.querySelector<HTMLElement>('[data-filter-trigger="true"]') || null;

  return {
    th,
    triggerEl
  };
}

export function openColumnFilter(request: {
  anchorEl?: HTMLElement | null;
  columnId: string;
  focusInput?: boolean;
  returnFocusEl?: HTMLElement | null;
  type?: string;
}): boolean {
  const controller = getColumnFilterController();
  if (controller?.open(request)) {
    return true;
  }

  const result = openLegacyColumnFilter(request, {
    actions: legacyFilterActions,
    getProcessor,
    setupScrollInput,
    updateFilterCounts
  });
  lastColumnFilterReturnFocusEl = result.returnFocusEl;
  return result.opened;
}

export function focusNameColumnFilter(): boolean {
  const existingInput =
    document
      .querySelector<HTMLElement>('#filter-name.show')
      ?.querySelector<HTMLInputElement>('#filter-input-name') ?? null;
  const activeElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (existingInput) {
    existingInput.focus();
    existingInput.select();
    lastColumnFilterReturnFocusEl = activeElement;
    return true;
  }

  const { triggerEl } = resolveFilterContext('name');
  return openColumnFilter({
    anchorEl: triggerEl,
    columnId: 'name',
    focusInput: true,
    returnFocusEl: activeElement
  });
}

export function openFilter(e: MouseEvent, id: string, type: string): void {
  e.stopPropagation();
  const target = e.target as HTMLElement;
  const triggerEl = target.closest<HTMLElement>('[data-filter-trigger="true"]');
  openColumnFilter({
    anchorEl: triggerEl,
    columnId: id,
    returnFocusEl: triggerEl,
    type
  });
}

export function resetAllFilters(): void {
  useTableStore.getState().clearFilters();
  markHeadersDirty();
  scheduleTableRender();
  closeFilters();
}

export function resetColumnFilter(id: string): void {
  useTableStore.getState().resetColumnFilter(id);
  closeFilters();
  scheduleTableRender();
}

export function setFilterArr(id: string, v: string): void {
  useTableStore.getState().toggleColumnFilterValue(id, v);
}

export function setupScrollInput(elemId: string, step: number, defaultStart: number): void {
  const el = document.getElementById(elemId) as HTMLInputElement | null;
  if (!el) return;
  el.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      let val: number;
      if (el.value === '' || el.value === null || isNaN(parseFloat(el.value))) {
        val = defaultStart === undefined ? 0 : defaultStart;
      } else {
        val = parseFloat(el.value);
        if (isNaN(val)) val = defaultStart === undefined ? 0 : defaultStart;
      }

      const delta = e.deltaY < 0 ? 1 : -1;
      val += delta * step;

      if (val < 0) val = 0;

      if (step < 1) {
        const decimals = step.toString().split('.')[1]?.length || 0;
        const multiplier = Math.pow(10, decimals);
        val = Math.round(val * multiplier) / multiplier;
      } else {
        val = Math.round(val);
      }

      const maxAttr = el.getAttribute('max');
      if (maxAttr && val > parseFloat(maxAttr)) val = parseFloat(maxAttr);

      el.value = val.toString();
    },
    { passive: false }
  );
}

export function sortPositionsIntelligently(positions: string[]): string[] {
  return sortPositionsByModel(positions);
}

export function toggleAllVisible(id: string): void {
  const list = document.getElementById(`list-${id}`);
  if (!list) return;
  const visibleCheckboxes = [...list.querySelectorAll('label')]
    .filter((l) => (l as HTMLElement).style.display !== 'none')
    .map((l) => l.querySelector('input'));
  const allChecked = visibleCheckboxes.every((cb) => cb.checked);
  visibleCheckboxes.forEach((cb) => {
    cb.checked = !allChecked;
    const v = cb.value;
    if (!store.activeFilters[id]) store.activeFilters[id] = [];
    if (allChecked) {
      const idx = store.activeFilters[id].indexOf(v);
      if (idx !== -1) store.activeFilters[id].splice(idx, 1);
    } else {
      if (!store.activeFilters[id].includes(v)) store.activeFilters[id].push(v);
    }
  });
  if (store.activeFilters[id]?.length === 0) delete store.activeFilters[id];
  updateFilterCounts(id);
}

export function toggleShowActiveInFilter(id: string): void {
  const list = document.getElementById(`list-${id}`);
  if (!list) return;
  const button = document.getElementById(`show-active-btn-${id}`);
  if (!button) return;
  const labels = list.querySelectorAll('label');

  const checkedValues = store.activeFilters[id] || [];
  const activeCount = checkedValues.length;
  const totalCount = labels.length;

  const isShowingOnlyActive = button.textContent.includes('wszystkie');

  if (isShowingOnlyActive) {
    labels.forEach((label) => {
      (label as HTMLElement).style.display = 'flex';
    });
    button.textContent = `Pokaż na liście tylko aktywne (${activeCount})`;
  } else {
    labels.forEach((label) => {
      const input = label.querySelector('input');
      if (!input) return;
      const value = input.value;
      const isChecked = checkedValues.includes(value);
      (label as HTMLElement).style.display = isChecked ? 'flex' : 'none';
    });
    button.textContent = `Pokaż na liście wszystkie (${totalCount})`;
  }

  updateFilterCounts(id);
}

export function updateFilterCounts(id: string): void {
  const filterRuntime = getFilterRuntime();
  const list = document.getElementById(`list-${id}`);
  if (!list) return;
  const labels = list.querySelectorAll('label');
  const visibleLabels = [...labels].filter((l) => (l as HTMLElement).style.display !== 'none');
  const visibleCount = visibleLabels.length;
  const totalCount = labels.length;
  const activeCount = store.activeFilters[id] ? store.activeFilters[id].length : 0;

  const toggleBtn = document.getElementById(`toggle-visible-btn-${id}`);
  if (toggleBtn) {
    toggleBtn.textContent = `Zaznacz/odznacz widoczne (${visibleCount})`;
  }

  const showActiveBtn = document.getElementById(`show-active-btn-${id}`);
  if (showActiveBtn) {
    const isShowingOnlyActive = showActiveBtn.textContent.includes('wszystkie');
    showActiveBtn.textContent = isShowingOnlyActive
      ? `Pokaż na liście wszystkie (${totalCount})`
      : `Pokaż na liście tylko aktywne (${activeCount})`;
  }

  if (id === 'league') {
    const ldcMatchedText = document.getElementById(`filter-ldc-matched-text-${id}`);
    if (ldcMatchedText) {
      let matchedCount = 0;
      const ldcLeagueNames = new Set<string>();
      const LDC_SETTINGS = getLdcSettings();
      if (LDC_SETTINGS?.leagues) {
        LDC_SETTINGS.leagues.forEach((league: any) => {
          ldcLeagueNames.add(league.name);
          const normalized = normalizeLeagueNameForGrouping(league.name);
          if (normalized !== league.name) {
            ldcLeagueNames.add(normalized);
          }
        });
      }
      const mappings = loadLeagueMappings();

      labels.forEach((label) => {
        const input = label.querySelector('input');
        if (!input) return;
        const leagueName = input.value;
        const normalized = normalizeLeagueNameForGrouping(leagueName);
        const isMatched =
          ldcLeagueNames.has(leagueName) ||
          ldcLeagueNames.has(normalized) ||
          mappings[leagueName] !== undefined ||
          mappings[normalized] !== undefined;
        if (isMatched) matchedCount++;
      });

      ldcMatchedText.textContent = `Pokaż na liście filtra tylko ligi dopasowane w LDC (${matchedCount})`;
    }
  }

  if (id === 'club') {
    const clubPossessionText = document.getElementById(`filter-club-possession-text-${id}`);
    if (clubPossessionText) {
      let possessionCount = 0;
      labels.forEach((label) => {
        const input = label.querySelector('input');
        if (!input) return;
        const clubName = input.value;
        const possession = filterRuntime.getTeamPossession(clubName);
        if (possession !== null && possession !== undefined) {
          possessionCount++;
        }
      });

      clubPossessionText.textContent = `Pokaż tylko kluby z przypisanym posiadaniem piłki (${possessionCount})`;
    }
  }
}

const legacyFilterActions = {
  applyFilter,
  filterCheckboxList,
  filterClubHasPossession,
  filterShowOnlyLDCMatched,
  persistUIState,
  setFilterArr,
  setPositionFilterMode: (mode: string) => {
    if (mode !== 'and' && mode !== 'or') return;
    // Legacy table store is a shared mutable singleton (window.store).
    store.positionFilterMode = mode;
  },
  updateFilterCounts
};
