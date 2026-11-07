import { flexRender } from '@tanstack/react-table';
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  MoreHorizontal,
  Pin,
  Play,
  RotateCcw
} from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { ColumnFilterPopover } from '@/components/ColumnFilterPopover';
import { useDataBoundary } from '@/hooks/useDataBoundary';
import { usePlayerTable } from '@/hooks/usePlayerTable';
import { useUiText } from '@/hooks/useUiText';
import { cn } from '@/lib/utils';
import { store as legacyTableStore } from '@/store/tableStore';
import { useTableStore } from '@/store/useTableStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import {
  handleHeaderDragEnter,
  handleHeaderDragLeave,
  handleHeaderDragOver,
  handleHeaderDragStart,
  handleHeaderDrop,
  togglePin
} from '@/ui/columnManager';
import {
  registerColumnFilterController,
  type OpenColumnFilterRequest
} from '@/ui/filterController';

const PlayerTable = () => {
  const t = useUiText();
  const [mutedHeaderActionsColumnId, setMutedHeaderActionsColumnId] = useState<null | string>(null);
  const [openFilterRequest, setOpenFilterRequest] = useState<null | OpenColumnFilterRequest>(null);
  const filterReturnFocusRef = useRef<HTMLElement | null>(null);
  const {
    activeColumnDefs,
    columnWidths,
    currentPage,
    filteredRows,
    pageCount,
    pageEnd,
    pageInput,
    pageStart,
    pinnedOffsets,
    rowsPerPage,
    selectedPlayerId,
    setCurrentPage,
    setPageInput,
    setSelectedPlayerId,
    setRowsPerPage,
    table,
    tableContainerRef,
    totalRows
  } = usePlayerTable();
  const { analysisReady, clearFilters, currentPosition, currentSort, data } = useTableStore();
  const { rememberFocus } = useWorkspaceStore();
  const { runAnalysis } = useDataBoundary();

  const canAnalyze = data.length > 0 && currentPosition.length > 0;
  const hasLegacyFilters = Object.keys(legacyTableStore.activeFilters).length > 0;
  const commitPageInput = () => {
    const nextPage = Math.min(pageCount, Math.max(1, Number(pageInput) || 1));
    setCurrentPage(nextPage);
  };
  const stickyHeaderGlassStyle = {
    backdropFilter: 'blur(8px)',
    backgroundColor: 'rgb(255 255 255 / 0.95)'
  } as CSSProperties;
  const pinnedColumnIds = new Set<string>(legacyTableStore.pinnedColumns);
  const lastPinnedColumnId =
    activeColumnDefs.toReversed().find((column) => pinnedColumnIds.has(column.id))?.id ?? null;

  const closeColumnFilter = (options: { restoreFocus?: boolean } = {}) => {
    setOpenFilterRequest(null);
    if (options.restoreFocus && filterReturnFocusRef.current) {
      window.setTimeout(() => filterReturnFocusRef.current?.focus(), 0);
    }
    if (options.restoreFocus) {
      filterReturnFocusRef.current = null;
    }
  };

  const openColumnFilterRequest = (request: OpenColumnFilterRequest) => {
    const type =
      request.type || activeColumnDefs.find((column) => column.id === request.columnId)?.type || '';
    if (!type) {
      return false;
    }

    filterReturnFocusRef.current =
      request.returnFocusEl ??
      request.anchorEl ??
      document.querySelector<HTMLElement>(`th[data-col-id="${request.columnId}"]`);
    setOpenFilterRequest({ ...request, type });
    return true;
  };

  useEffect(
    () =>
      registerColumnFilterController({
        close: closeColumnFilter,
        isOpen: () => openFilterRequest !== null,
        open: openColumnFilterRequest
      }),
    [activeColumnDefs, openFilterRequest]
  );

  const renderRow = (row: (typeof filteredRows)[number], key: string, rowIndex: number) => {
    const uid = String(row.original.uid);
    const isSelected = selectedPlayerId === uid;
    const isStripedRow = rowIndex % 2 === 1;
    const rowBackground = isSelected
      ? 'color-mix(in oklch, var(--color-accent) 8%, white 92%)'
      : isStripedRow
        ? 'color-mix(in oklch, var(--color-surface-hover) 55%, white 45%)'
        : 'var(--color-background)';
    const pinnedRowBackground = isSelected
      ? 'rgb(239 246 255 / 0.95)'
      : isStripedRow
        ? 'rgb(249 250 251 / 0.95)'
        : 'rgb(255 255 255 / 0.95)';
    const rowHoverBackground = isSelected ? rowBackground : 'var(--color-surface)';
    const pinnedRowHoverBackground = isSelected ? pinnedRowBackground : 'rgb(255 255 255 / 1)';
    const rowStyle = {
      '--pinned-row-background': pinnedRowBackground,
      '--pinned-row-hover-background': pinnedRowHoverBackground,
      '--row-background': rowBackground,
      '--row-hover-background': rowHoverBackground
    } as CSSProperties;

    return (
      <tr
        key={key}
        tabIndex={0}
        onClick={(event) => {
          rememberFocus(event.currentTarget);
          setSelectedPlayerId(uid);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            rememberFocus(event.currentTarget);
            setSelectedPlayerId(uid);
          }
        }}
        aria-selected={isSelected}
        style={rowStyle}
        className={cn(
          'group border-b border-border/40 bg-[var(--row-background)] transition outline-none',
          'hover:bg-[var(--row-hover-background)] focus-visible:bg-[var(--row-hover-background)] focus-visible:ring-2 focus-visible:ring-accent/30'
        )}
      >
        {row.getVisibleCells().map((cell) => {
          const columnId = cell.column.id;
          const isPinned = pinnedColumnIds.has(columnId);
          const isPinnedBoundary = columnId === lastPinnedColumnId;
          const columnWidth = columnWidths[columnId] ?? 120;
          const cellStyle = {
            width: `${columnWidth}px`,
            minWidth: `${columnWidth}px`,
            ...(isPinned
              ? {
                  backdropFilter: 'blur(8px)',
                  left: pinnedOffsets[columnId] ?? 0
                }
              : {}),
            boxShadow: [
              isSelected
                ? 'inset 0 1px 0 0 color-mix(in oklch, var(--color-accent) 30%, white 70%), inset 0 -1px 0 0 color-mix(in oklch, var(--color-accent) 30%, white 70%)'
                : null,
              isPinnedBoundary
                ? 'inset -1px 0 0 0 color-mix(in oklch, var(--color-border-strong) 35%, white 65%), 8px 0 10px -12px rgb(15 23 42 / 0.08)'
                : null
            ]
              .filter(Boolean)
              .join(', ')
          } as CSSProperties;

          return (
            <td
              key={cell.id}
              data-col-id={columnId}
              className={cn(
                'px-3 py-2 align-top text-[12px] text-text-secondary',
                isPinned &&
                  'sticky z-10 bg-[var(--pinned-row-background)] backdrop-blur group-hover:bg-[var(--pinned-row-hover-background)]'
              )}
              style={cellStyle}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          );
        })}
      </tr>
    );
  };

  if (totalRows === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface-hover">
          <MoreHorizontal className="h-8 w-8 text-text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary">{t('no_data_loaded')}</h3>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div
        id="table-scroller"
        ref={tableContainerRef}
        className="min-h-[18rem] flex-1 overflow-auto md:min-h-[24rem]"
        style={{ contain: 'strict' }}
      >
        <div className="border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-xs font-medium text-text-secondary">
              <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-text-secondary">
                {t('showing_results', 'ui', {
                  count: totalRows,
                  total: data.length
                })}
              </span>
              {analysisReady ? null : (
                <span className="rounded-full bg-accent-subtle px-2.5 py-1 text-text-secondary">
                  {t('select_role_to_score')}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <button
                id="run-analysis"
                type="button"
                onClick={() => runAnalysis(useTableStore.getState().currentEngine, currentPosition)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition',
                  canAnalyze
                    ? 'bg-accent text-white shadow-lg shadow-accent/20 hover:bg-accent-hover'
                    : 'border border-accent/20 bg-accent-subtle text-accent hover:border-accent/40 hover:bg-accent/10'
                )}
              >
                <Play className="h-4 w-4" />
                <span>{canAnalyze ? t('analyze') : t('choose_role')}</span>
              </button>

              <button
                id="clear-all-filters"
                type="button"
                onClick={clearFilters}
                disabled={!hasLegacyFilters}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                <span>{t('reset_filters')}</span>
              </button>
            </div>
          </div>
        </div>

        <table className="w-full border-collapse table-auto">
          <thead
            id="table-headers"
            className="sticky top-0 z-20 border-b border-border bg-background/95"
            style={{
              boxShadow:
                'inset 0 -1px 0 0 color-mix(in oklch, var(--color-border-strong) 35%, white 65%), 0 6px 10px -12px rgb(15 23 42 / 0.14)'
            }}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const column = activeColumnDefs[index];
                  const columnId = column?.id ?? header.column.id;
                  const isPinned = pinnedColumnIds.has(columnId);
                  const isPinnedBoundary = columnId === lastPinnedColumnId;
                  const filterActive = legacyTableStore.activeFilters[columnId] !== undefined;
                  const columnWidth = columnWidths[columnId] ?? 120;
                  const stickyStyle = isPinned
                    ? {
                        left: pinnedOffsets[columnId] ?? 0
                      }
                    : undefined;

                  return (
                    <th
                      key={header.id}
                      data-col-id={columnId}
                      data-col-type={column?.type ?? ''}
                      draggable
                      className={cn(
                        'group relative cursor-move bg-background/95 px-3 py-2.5 text-left align-middle backdrop-blur transition hover:bg-surface',
                        isPinned && 'sticky z-30'
                      )}
                      style={{
                        ...stickyStyle,
                        ...stickyHeaderGlassStyle,
                        boxShadow: isPinnedBoundary
                          ? 'inset -1px 0 0 0 color-mix(in oklch, var(--color-border-strong) 35%, white 65%), 8px 0 10px -12px rgb(15 23 42 / 0.08)'
                          : undefined,
                        minWidth: `${columnWidth}px`,
                        width: `${columnWidth}px`
                      }}
                      onMouseLeave={() => {
                        if (mutedHeaderActionsColumnId === columnId) {
                          setMutedHeaderActionsColumnId(null);
                        }
                      }}
                      onDragEnter={(event) => handleHeaderDragEnter(event.nativeEvent)}
                      onDragLeave={(event) => handleHeaderDragLeave(event.nativeEvent)}
                      onDragOver={(event) => handleHeaderDragOver(event.nativeEvent)}
                      onDragStart={(event) => handleHeaderDragStart(event.nativeEvent, columnId)}
                      onDrop={(event) => handleHeaderDrop(event.nativeEvent, columnId)}
                    >
                      <div className="relative min-h-[1.75rem] pr-[3.75rem]">
                        <button
                          type="button"
                          className="flex min-h-[1.75rem] min-w-0 max-w-full items-center gap-1.5 text-[10px] leading-none font-semibold uppercase tracking-[0.18em] text-text-muted transition hover:text-text-primary"
                          title={column?.fullName || column?.name || header.column.id}
                          onClick={() => {
                            const nextSort =
                              currentSort.col === columnId && currentSort.dir === 'desc'
                                ? 'asc'
                                : 'desc';
                            header.column.toggleSorting(nextSort === 'desc');
                          }}
                        >
                          <span className="truncate">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {{
                            asc: <ChevronUp className="h-3 w-3 text-accent" />,
                            desc: <ChevronDown className="h-3 w-3 text-accent" />
                          }[header.column.getIsSorted() as string] ?? (
                            <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />
                          )}
                        </button>

                        <div
                          className={cn(
                            'absolute right-0 top-1/2 flex -translate-y-1/2 shrink-0 items-center gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100',
                            mutedHeaderActionsColumnId === columnId &&
                              'pointer-events-none opacity-0'
                          )}
                        >
                          <button
                            type="button"
                            className={cn(
                              'action-icon inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/80 bg-background/85 text-text-muted transition hover:border-border hover:bg-surface hover:text-text-primary focus-visible:opacity-100',
                              isPinned &&
                                'active pinned border-border bg-surface text-accent opacity-100'
                            )}
                            onClick={(event) => {
                              togglePin(event.nativeEvent, columnId);
                              setMutedHeaderActionsColumnId(columnId);
                            }}
                            title={t('pin')}
                          >
                            <Pin className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            className={cn(
                              'action-icon inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/80 bg-background/85 text-text-muted transition hover:border-border hover:bg-surface hover:text-text-primary focus-visible:opacity-100',
                              filterActive &&
                                'active border-border bg-surface text-accent opacity-100',
                              openFilterRequest?.columnId === columnId &&
                                'open border-border bg-surface text-accent opacity-100'
                            )}
                            onClick={(event) =>
                              openColumnFilterRequest({
                                anchorEl: event.currentTarget,
                                columnId,
                                returnFocusEl: event.currentTarget,
                                type: column?.type ?? ''
                              })
                            }
                            data-filter-trigger="true"
                            title={t('filter')}
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <ColumnFilterPopover
                        columnId={columnId}
                        isOpen={openFilterRequest?.columnId === columnId}
                        type={
                          openFilterRequest?.columnId === columnId
                            ? (openFilterRequest.type ?? column?.type ?? '')
                            : (column?.type ?? '')
                        }
                      />
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody id="table-body">
            {filteredRows.map((row, rowIndex) => renderRow(row, row.id, rowIndex))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/40 px-4 py-3 text-xs text-text-secondary">
        <div className="font-medium">
          {t('displayed_rows', 'ui', { end: pageEnd, start: pageStart, total: totalRows })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <span>{t('rows_per_page')}</span>
            <select
              value={rowsPerPage}
              data-testid="pagination-rows-per-page"
              onChange={(event) => setRowsPerPage(Number(event.target.value))}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold text-text-primary"
            >
              {[10, 25, 50, 100].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage <= 1}
            data-testid="pagination-first"
            className="rounded-lg border border-border bg-background p-2 text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t('first_page')}
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            data-testid="pagination-prev"
            className="rounded-lg border border-border bg-background p-2 text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t('prev_page')}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
            <span>{t('page')}</span>
            <input
              type="number"
              min={1}
              max={pageCount}
              value={pageInput}
              data-testid="pagination-page-input"
              onChange={(event) => setPageInput(event.target.value)}
              onBlur={commitPageInput}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitPageInput();
                }
              }}
              className="w-12 bg-transparent text-center font-semibold text-text-primary outline-none"
              aria-label={t('page')}
            />
            <span>
              {t('of')} {pageCount}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
            disabled={currentPage >= pageCount}
            data-testid="pagination-next"
            className="rounded-lg border border-border bg-background p-2 text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t('next_page')}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage(pageCount)}
            disabled={currentPage >= pageCount}
            data-testid="pagination-last"
            className="rounded-lg border border-border bg-background p-2 text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t('last_page')}
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerTable;
