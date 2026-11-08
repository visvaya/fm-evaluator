import {
  createColumnHelper,
  columnVisibilityFeature,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  useTable
} from '@tanstack/react-table';
import { useEffect, useMemo, useRef, useState } from 'react';

import { PlayerNameCell } from '@/components/PlayerNameCell';
import { getReactTableRows } from '@/lib/reactTableCompat';
import { cn } from '@/lib/utils';
import { store as legacyTableStore } from '@/store/tableStore';
import { useTableStore } from '@/store/useTableStore';
import { buildActiveColumns } from '@/ui/columnManager';

import type { Player } from '@/ui/types';

// Only the sorting state lives in the table; the app sorts and pages the data itself. Column
// visibility provides row.getVisibleCells().
const PLAYER_TABLE_FEATURES = tableFeatures({ columnVisibilityFeature, rowSortingFeature });
const columnHelper = createColumnHelper<typeof PLAYER_TABLE_FEATURES, Player>();
const IMPORT_COLUMN_IDS = new Set([
  'age',
  'club',
  'dataCategory',
  'foot',
  'league',
  'mins',
  'name',
  'position',
  'value',
  'wage'
]);
const ANALYSIS_COLUMN_IDS = new Set([
  'age',
  'attrScore',
  'club',
  'dataCategory',
  'foot',
  'league',
  'mins',
  'name',
  'position',
  'statScore',
  'suggestion',
  'totalScore',
  'value',
  'wage'
]);

function getColumnWidth(column: { savedWidth?: number; w?: string }) {
  return column.savedWidth ?? (column.w ? Number.parseInt(column.w, 10) : 120);
}

export function usePlayerTable() {
  const {
    analysisReady,
    currentPage,
    currentPosition,
    compatRevision,
    currentSort,
    data,
    filteredData,
    rowsPerPage,
    selectedPlayerId,
    setCurrentPage,
    setFilteredData,
    setSelectedPlayerId,
    setRowsPerPage,
    setSort
  } = useTableStore();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [pageInput, setPageInput] = useState(String(currentPage));
  // The page box shows the current page again whenever the page changes; adjusting state during
  // render avoids the extra render an effect would cause.
  const [pageInputSource, setPageInputSource] = useState(currentPage);
  if (pageInputSource !== currentPage) {
    setPageInputSource(currentPage);
    setPageInput(String(currentPage));
  }

  const visibleColumnDefs = useMemo(() => {
    const builtColumns = buildActiveColumns();
    const allowedColumns = analysisReady ? ANALYSIS_COLUMN_IDS : IMPORT_COLUMN_IDS;
    return builtColumns.filter((column) => allowedColumns.has(column.id));
  }, [analysisReady, compatRevision, currentPosition]);

  const activeColumns = useMemo(
    () =>
      visibleColumnDefs.map((column) =>
        columnHelper.accessor((row) => row[column.id], {
          cell: (info) => {
            const value = info.getValue();

            if (
              column.type === 'range' &&
              (column.id.toLowerCase().includes('score') ||
                column.id === 'statScore' ||
                column.id === 'attrScore')
            ) {
              const score = Number(value) || 0;
              const normalizedWidth = Math.min(100, Math.max(0, (score / 20) * 100));

              return (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 min-w-[40px] overflow-hidden rounded-full bg-border">
                    <div
                      className={cn(
                        'h-full transition-all duration-500',
                        score >= 16 ? 'bg-positive' : score >= 12 ? 'bg-warning' : 'bg-negative'
                      )}
                      style={{ width: `${normalizedWidth}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-[11px] font-bold">
                    {typeof value === 'number' ? value.toFixed(1) : value || '0.0'}
                  </span>
                </div>
              );
            }

            if (column.id === 'name') {
              return <PlayerNameCell player={info.row.original} />;
            }

            return (
              <span
                className={cn(
                  'block truncate',
                  typeof value === 'number'
                    ? 'tabular-nums font-medium text-text-primary'
                    : 'text-text-secondary'
                )}
              >
                {value?.toString() || '–'}
              </span>
            );
          },
          header: () => column.name,
          id: column.id
        })
      ),
    [visibleColumnDefs]
  );

  const tableData = useMemo(() => getReactTableRows(data, ''), [compatRevision, data]);

  useEffect(() => {
    if (filteredData !== tableData) {
      setFilteredData(tableData);
    }
  }, [filteredData, setFilteredData, tableData]);

  const totalRows = tableData.length;
  const pageCount = totalRows === 0 ? 1 : Math.ceil(totalRows / rowsPerPage);

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount, setCurrentPage]);

  const pagedTableData = useMemo(() => {
    const safePage = Math.min(Math.max(1, currentPage), pageCount);
    const startIndex = (safePage - 1) * rowsPerPage;
    return tableData.slice(startIndex, startIndex + rowsPerPage);
  }, [currentPage, pageCount, rowsPerPage, tableData]);

  const pageStart =
    totalRows === 0 ? 0 : (Math.min(Math.max(1, currentPage), pageCount) - 1) * rowsPerPage + 1;
  const pageEnd = totalRows === 0 ? 0 : Math.min(totalRows, pageStart + pagedTableData.length - 1);

  const sorting: SortingState = useMemo(
    () => [{ desc: currentSort.dir === 'desc', id: currentSort.col }],
    [currentSort]
  );

  const table = useTable({
    columns: activeColumns,
    data: pagedTableData,
    features: PLAYER_TABLE_FEATURES,
    onSortingChange: (updater) => {
      const nextSorting = typeof updater === 'function' ? updater(sorting) : updater;
      if (nextSorting.length > 0) {
        setSort({
          col: nextSorting[0].id,
          dir: nextSorting[0].desc ? 'desc' : 'asc'
        });
      }
    },
    state: { sorting }
  });

  const { rows } = table.getRowModel();

  const columnWidths = useMemo(
    () =>
      Object.fromEntries(visibleColumnDefs.map((column) => [column.id, getColumnWidth(column)])),
    [visibleColumnDefs]
  );

  const pinnedOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let leftOffset = 0;
    for (const column of visibleColumnDefs) {
      offsets[column.id] = leftOffset;
      if (legacyTableStore.pinnedColumns.includes(column.id)) {
        leftOffset += columnWidths[column.id] ?? 120;
      }
    }
    return offsets;
  }, [columnWidths, compatRevision, visibleColumnDefs]);

  return {
    activeColumns,
    activeColumnDefs: visibleColumnDefs,
    columnWidths,
    currentPage,
    filteredRows: rows,
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
  };
}
