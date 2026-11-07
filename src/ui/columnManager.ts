// Phase 5B: Column management UI – modal, DnD reorder, resize, header listeners
// Migrated from main.js L11217-11533

import { COLUMNS, DEFAULT_COLUMNS, getEls } from '../config/columns';
import { persistUIState, scheduleTableRender } from '../lib/uiBridge';
import { markFiltersDirty, markHeadersDirty, store } from '../store/tableStore';
import { escapeHtmlAttribute } from '../utils/escapeHtmlAttribute';

import type { ColumnDef } from '../config/columns';

// Module-scoped DnD state
let draggedItem: null | number = null;

// Resize state
const resizeData = {
  columnId: null as null | string,
  isResizing: false,
  minWidth: 0,
  startWidth: 0,
  startX: 0
};

// Header DnD state
const headerDragData = {
  draggedElement: null as HTMLElement | null,
  draggedId: null as null | string
};

/**
 * Legacy table binding, reference for React parity. Unused today; kept until the React/TS migration decides its fate.
 * @public
 */
export function bindColumnModalListeners(): void {
  const els = getEls();

  document.querySelector('#columns-btn')?.addEventListener('click', renderColumnList);

  document.querySelector('#reset-default-widths')?.addEventListener('click', () => {
    COLUMNS.forEach((c) => {
      delete c.savedWidth;
    });
    markHeadersDirty();
    persistUIState();
    scheduleTableRender();
  });

  document.querySelector('#reset-columns')?.addEventListener('click', () => {
    const newCols: ColumnDef[] = JSON.parse(JSON.stringify(DEFAULT_COLUMNS));
    COLUMNS.length = 0;
    newCols.forEach((c) => COLUMNS.push(c));
    store.hiddenColumns = COLUMNS.filter((c) => c.hidden).map((c) => c.id);
    store.pinnedColumns = [];
    COLUMNS.forEach((c) => {
      delete c.savedWidth;
    });
    renderColumnList();
    markHeadersDirty();
    store.currentPage = 1;
    persistUIState();
    scheduleTableRender();
  });

  document.querySelector('#close-columns')?.addEventListener('click', () => {
    els.colModal?.classList.add('hidden');
  });

  els.toggleRole?.addEventListener('click', () => {
    store.roleFiltersEnabled = !store.roleFiltersEnabled;
    els.toggleRole?.classList.toggle('active-state', store.roleFiltersEnabled);
    markFiltersDirty();
    store.currentPage = 1;
    persistUIState();
    scheduleTableRender();
  });
}

/**
 * Legacy table binding, reference for React parity. Unused today; kept until the React/TS migration decides its fate.
 * @public
 */
export function bindTableHeaderListeners(): void {
  const els = getEls();
  if (!els.tableHead) return;
  if ((els.tableHead as any).dataset?.fmHeaderListeners === 'true') return;
  if ((els.tableHead as any).dataset) {
    (els.tableHead as any).dataset.fmHeaderListeners = 'true';
  }

  els.tableHead.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target?.closest?.('.filter-popup')) {
      e.stopPropagation();
      return;
    }

    const actionEl = target?.closest?.('[data-action]');
    if (!actionEl) return;
    const action = (actionEl as HTMLElement).dataset.action;
    const colId = (actionEl as HTMLElement).dataset.colId;
    if (!action || !colId) return;

    if (action === 'sort') {
      (window as any).handleSort?.(colId);
      return;
    }
    if (action === 'pin') {
      togglePin(e, colId);
      return;
    }
    if (action === 'filter') {
      const colType = (actionEl as HTMLElement).dataset.colType || '';
      (window as any).openFilter?.(e, colId, colType);
      return;
    }
  });

  els.tableHead.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    const handle = target?.closest?.<HTMLElement>('.resize-handle[data-col-id]');
    if (!handle) return;
    const colId = handle.dataset.colId;
    if (!colId) return;
    handleResizeStart(e, colId);
  });

  els.tableHead.addEventListener('dragstart', (e) => {
    const target = e.target as HTMLElement;
    const th = target?.closest?.<HTMLElement>('th[data-col-id]');
    if (!th) return;
    const colId = th.dataset.colId;
    if (!colId) return;
    handleHeaderDragStart(e, colId);
  });

  els.tableHead.addEventListener('dragover', (e) => {
    handleHeaderDragOver(e);
  });

  els.tableHead.addEventListener('drop', (e) => {
    const target = e.target as HTMLElement;
    const th = target?.closest?.<HTMLElement>('th[data-col-id]');
    if (!th) return;
    const colId = th.dataset.colId;
    if (!colId) return;
    handleHeaderDrop(e, colId);
  });

  els.tableHead.addEventListener('dragenter', (e) => {
    handleHeaderDragEnter(e);
  });

  els.tableHead.addEventListener('dragleave', (e) => {
    handleHeaderDragLeave(e);
  });
}

export function buildActiveColumns(): ColumnDef[] {
  const currentPosition =
    document.querySelector<HTMLSelectElement>('#position-select')?.value ?? '';
  const isVisible = (c: ColumnDef): boolean => {
    if (!store.hiddenColumns.includes(c.id)) {
      if (
        (c.id === 'bestRoleTotal' || c.id === 'bestRoleStat' || c.id === 'bestRoleAttr') &&
        currentPosition === 'BEST'
      ) {
        return false;
      }
      return true;
    }
    return false;
  };

  const pinned = COLUMNS.filter(
    (column) => store.pinnedColumns.includes(column.id) && isVisible(column)
  );
  const unpinned = COLUMNS.filter(
    (column) => !store.pinnedColumns.includes(column.id) && isVisible(column)
  );

  return [...pinned, ...unpinned];
}

export function calculateColumnWidth(columnName: string): number {
  const measureEl = document.createElement('span');
  measureEl.style.cssText =
    'position: absolute; visibility: hidden; white-space: nowrap; font-family: system-ui, -apple-system, sans-serif; font-size: 10px; font-weight: 900; letter-spacing: 0.05em;';
  measureEl.textContent = `${columnName} ▼`;
  document.body.append(measureEl);
  const textWidth = measureEl.offsetWidth;
  measureEl.remove();

  const padding = 24;
  const nameToIconsGap = 8;
  const iconsWidth = 44;
  const safetyMargin = 8;

  return textWidth + padding + nameToIconsGap + iconsWidth + safetyMargin;
}

const DROP_TARGET_CLASSES = ['bg-blue-50', 'border-blue-300'];

export function handleDragEnter(e: DragEvent): void {
  (e.currentTarget as HTMLElement).classList.add(...DROP_TARGET_CLASSES);
}

export function handleDragLeave(e: DragEvent): void {
  (e.currentTarget as HTMLElement).classList.remove(...DROP_TARGET_CLASSES);
}

export function handleDragOver(e: DragEvent): void {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

export function handleDragStart(e: DragEvent, idx: number): void {
  startRowDrag(e, e.target as HTMLElement, idx);
}

function startRowDrag(e: DragEvent, row: HTMLElement, idx: number): void {
  draggedItem = idx;
  e.dataTransfer.effectAllowed = 'move';
  row.style.opacity = '0.5';
}

export function handleDrop(e: DragEvent, targetIdx: number): void {
  dropOnRow(e, e.currentTarget as HTMLElement, targetIdx);
}

function dropOnRow(e: DragEvent, row: HTMLElement, targetIdx: number): void {
  e.preventDefault();
  row.classList.remove(...DROP_TARGET_CLASSES);
  if (draggedItem === null) return;
  const item = COLUMNS[draggedItem];
  COLUMNS.splice(draggedItem, 1);
  COLUMNS.splice(targetIdx, 0, item);
  renderColumnList();
  markHeadersDirty();
  store.currentPage = 1;
  scheduleTableRender();
}

export function handleHeaderDragEnter(e: DragEvent): void {
  e.preventDefault();
  const th =
    e.target && (e.target as HTMLElement).closest
      ? (e.target as HTMLElement).closest('th[data-col-id]')
      : null;
  if (!th) return;
  if ((th as HTMLElement).dataset.colId !== headerDragData.draggedId) {
    (th as HTMLElement).style.backgroundColor = '#dbeafe';
  }
}

export function handleHeaderDragLeave(e: DragEvent): void {
  const th =
    e.target && (e.target as HTMLElement).closest
      ? (e.target as HTMLElement).closest('th[data-col-id]')
      : null;
  if (!th) return;
  const relatedTarget = e.relatedTarget as HTMLElement | null;
  if (!th.contains(relatedTarget)) {
    (th as HTMLElement).style.backgroundColor = '';
  }
}

export function handleHeaderDragOver(e: DragEvent): void {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const th = (e.target as HTMLElement).closest('th') as HTMLElement | null;
  if (th && th.dataset.colId !== headerDragData.draggedId) {
    th.style.backgroundColor = '#dbeafe';
  }
}

export function handleHeaderDragStart(e: DragEvent, columnId: string): void {
  if (
    (e.target as HTMLElement).closest('.resize-handle') ||
    (e.target as HTMLElement).closest('.action-icon')
  ) {
    e.preventDefault();
    return;
  }
  headerDragData.draggedId = columnId;
  headerDragData.draggedElement = (e.target as HTMLElement).closest('th');
  e.dataTransfer.effectAllowed = 'move';
  if (headerDragData.draggedElement) {
    headerDragData.draggedElement.style.opacity = '0.5';
  }
  const dragEndHandler = () => {
    if (headerDragData.draggedElement) {
      headerDragData.draggedElement.style.opacity = '';
    }
    headerDragData.draggedId = null;
    headerDragData.draggedElement = null;
    document.removeEventListener('dragend', dragEndHandler);
  };
  document.addEventListener('dragend', dragEndHandler, { once: true });
}

export function handleHeaderDrop(e: DragEvent, targetId: string): void {
  e.preventDefault();
  e.stopPropagation();
  document.querySelectorAll('th[data-col-id]').forEach((th) => {
    (th as HTMLElement).style.backgroundColor = '';
  });
  if (headerDragData.draggedElement) {
    headerDragData.draggedElement.style.opacity = '';
  }
  if (!headerDragData.draggedId || headerDragData.draggedId === targetId) {
    headerDragData.draggedId = null;
    headerDragData.draggedElement = null;
    return;
  }

  const draggedIdx = COLUMNS.findIndex((c) => c.id === headerDragData.draggedId);
  const targetIdx = COLUMNS.findIndex((c) => c.id === targetId);
  if (draggedIdx === -1 || targetIdx === -1) {
    headerDragData.draggedId = null;
    headerDragData.draggedElement = null;
    return;
  }

  const item = COLUMNS[draggedIdx];
  COLUMNS.splice(draggedIdx, 1);
  COLUMNS.splice(targetIdx, 0, item);

  markHeadersDirty();
  store.currentPage = 1;
  persistUIState();
  scheduleTableRender();
  headerDragData.draggedId = null;
  headerDragData.draggedElement = null;
}

export function handleResizeStart(e: MouseEvent, columnId: string): void {
  e.stopPropagation();
  e.preventDefault();
  const th = (e.target as HTMLElement).closest('th') as HTMLElement | null;
  if (!th) return;
  const col = COLUMNS.find((c) => c.id === columnId);
  const minWidth = col ? calculateColumnWidth(col.name) : 100;

  resizeData.isResizing = true;
  resizeData.columnId = columnId;
  resizeData.startX = e.clientX;
  resizeData.startWidth = th.offsetWidth;
  resizeData.minWidth = minWidth;
  document.addEventListener('mousemove', handleResizeMove);
  document.addEventListener('mouseup', handleResizeEnd);
}

export function renderColumnList(): void {
  const els = getEls();
  if (!els.colList || !els.colModal) return;
  els.colList.innerHTML = COLUMNS.map((c, idx) => {
    const isChecked = !store.hiddenColumns.includes(c.id);
    return `
            <div class="flex items-center justify-between p-2 hover:bg-gray-100 rounded mb-1 text-ink border border-gray-200 transition" draggable="true" data-fm-col-index="${idx}">
                <div class="flex items-center gap-3"><i class="fas fa-bars text-gray-400 cursor-move hover:text-ink"></i><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${isChecked ? 'checked' : ''} data-fm-col-id="${escapeHtmlAttribute(c.id)}" class="accent-black"><span class="text-xs font-bold uppercase select-none">${escapeHtmlAttribute(c.name)}</span></label></div>
            </div>`;
  }).join('');
  bindColumnListEvents(els.colList);
  els.colModal.classList.remove('hidden');
}

// Delegated listeners replace the former inline on* attributes, which the strict CSP
// (ADR-004, script-src-attr 'none') blocks. Bound once per list element.
const boundColumnLists = new WeakSet<HTMLElement>();

function bindColumnListEvents(list: HTMLElement): void {
  if (boundColumnLists.has(list)) return;
  boundColumnLists.add(list);

  const rowOf = (event: Event) =>
    event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-fm-col-index]')
      : null;
  const indexOf = (row: HTMLElement) => Number.parseInt(row.dataset.fmColIndex ?? '', 10);

  list.addEventListener('dragstart', (event) => {
    const row = rowOf(event);
    if (row) startRowDrag(event, row, indexOf(row));
  });
  list.addEventListener('dragover', (event) => {
    if (rowOf(event)) handleDragOver(event);
  });
  list.addEventListener('drop', (event) => {
    const row = rowOf(event);
    if (row) dropOnRow(event, row, indexOf(row));
  });
  list.addEventListener('dragenter', (event) => {
    rowOf(event)?.classList.add(...DROP_TARGET_CLASSES);
  });
  list.addEventListener('dragleave', (event) => {
    rowOf(event)?.classList.remove(...DROP_TARGET_CLASSES);
  });
  list.addEventListener('change', (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const id = input?.dataset.fmColId;
    if (id) toggleCol(id);
  });
}

export function toggleCol(id: string): void {
  if ((window as any).tableState) {
    (window as any).tableState.toggleHidden(id);
    return;
  }
  if (store.hiddenColumns.includes(id))
    store.hiddenColumns = store.hiddenColumns.filter((x) => x !== id);
  else store.hiddenColumns.push(id);
  markHeadersDirty();
  persistUIState();
  store.currentPage = 1;
  scheduleTableRender();
}

export function togglePin(e: Event, id: string): void {
  e.stopPropagation();
  if ((window as any).tableState) {
    (window as any).tableState.togglePinned(id);
    return;
  }
  if (store.pinnedColumns.includes(id))
    store.pinnedColumns = store.pinnedColumns.filter((x) => x !== id);
  else store.pinnedColumns.push(id);
  markHeadersDirty();
  persistUIState();
  store.currentPage = 1;
  scheduleTableRender();
}

function handleResizeEnd(): void {
  if (!resizeData.isResizing) return;
  const els = getEls();
  const col = COLUMNS.find((c) => c.id === resizeData.columnId);
  if (col) {
    const th = els.tableHead?.querySelector(`th[data-col-id="${resizeData.columnId}"]`);
    if (th) {
      let savedWidth = (th as HTMLElement).offsetWidth;
      const minCalculatedWidth = calculateColumnWidth(col.name);
      savedWidth = Math.max(savedWidth, minCalculatedWidth);
      col.savedWidth = savedWidth;
      persistUIState();
    }
  }
  resizeData.isResizing = false;
  resizeData.columnId = null;
  document.removeEventListener('mousemove', handleResizeMove);
  document.removeEventListener('mouseup', handleResizeEnd);
}

function handleResizeMove(e: MouseEvent): void {
  if (!resizeData.isResizing) return;
  const els = getEls();
  const diff = e.clientX - resizeData.startX;
  const newWidth = Math.max(resizeData.minWidth, resizeData.startWidth + diff);
  const th = els.tableHead?.querySelector(`th[data-col-id="${resizeData.columnId}"]`);
  if (th) {
    (th as HTMLElement).style.width = `${newWidth}px`;
    (th as HTMLElement).style.minWidth = `${newWidth}px`;
    const tds = els.tableBody?.querySelectorAll(`td[data-col-id="${resizeData.columnId}"]`);
    tds?.forEach((td) => {
      (td as HTMLElement).style.width = `${newWidth}px`;
      (td as HTMLElement).style.minWidth = `${newWidth}px`;
    });
  }
}
