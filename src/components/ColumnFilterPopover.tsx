import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';

import { COLUMNS } from '@/config/columns';
import { translatePosition, translateValue } from '@/i18n/translate';
import { getFilterRuntime } from '@/lib/filterRuntime';
import { cn } from '@/lib/utils';
import { store as legacyTableStore } from '@/store/tableStore';
import { useTableStore } from '@/store/useTableStore';
import { applyFilter, resetColumnFilter, setupScrollInput } from '@/ui/filters';
import {
  isLdcMatchedLeague,
  sortPositionsIntelligently,
  STANDARD_POSITION_ORDER
} from '@/ui/filterModel';
import { normalizeDiacritics } from '@/utils/helpers';

const SCORE_RANGE_COLUMNS = new Set(['attrScore', 'statScore', 'totalScore']);
const FOOT_RANGE_COLUMNS = new Set(['leftFootStars', 'rightFootStars']);
const SPECIAL_RANGE_COLUMNS = new Set(['age', 'mins', 'value', 'wage']);
const WIDE_RANGE_COLUMNS = new Set(['mins', 'value', 'wage']);

interface ColumnFilterPopoverProps {
  columnId: string;
  isOpen: boolean;
  type: string;
}

function getLdcSettings() {
  return (window as any).LDC_SETTINGS as { leagues?: { name: string }[] } | undefined;
}

function getUniqueValues(columnId: string): string[] {
  if (columnId === 'position') {
    return sortPositionsIntelligently(STANDARD_POSITION_ORDER);
  }

  const values = new Set<string>();
  const rows = getFilterRuntime().calculatedScores;
  rows.forEach((row: Record<string, unknown>) => {
    const value = row[columnId];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      values.add(String(value));
    }
  });
  return [...values].toSorted((left, right) => left.localeCompare(right));
}

export function ColumnFilterPopover({ columnId, isOpen, type }: ColumnFilterPopoverProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const activeFilters = useTableStore((state) => state.activeFilters);
  const applyColumnFilter = useTableStore((state) => state.applyColumnFilter);
  const setPositionFilterMode = useTableStore((state) => state.setPositionFilterMode);
  const toggleColumnFilterValue = useTableStore((state) => state.toggleColumnFilterValue);
  const [listQuery, setListQuery] = useState('');
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [showOnlyLdcMatched, setShowOnlyLdcMatched] = useState(false);
  const [showOnlyPossession, setShowOnlyPossession] = useState(false);
  const filterRuntime = getFilterRuntime();

  const uniqueValues = useMemo(() => getUniqueValues(columnId), [columnId, isOpen]);
  const selectedValues: string[] = Array.isArray(activeFilters[columnId])
    ? activeFilters[columnId].filter((value): value is string => typeof value === 'string')
    : [];
  const isPosition = columnId === 'position';
  const isComplex = type === 'complex';
  const column = COLUMNS.find((item) => item.id === columnId);
  const rangeValue = activeFilters[columnId] as { max?: number; min?: number } | undefined;
  const currentSearchValue =
    typeof activeFilters[columnId] === 'string' ? activeFilters[columnId] : '';

  const filteredValues = uniqueValues.filter((value) => {
    if (listQuery) {
      const normalizedValue = normalizeDiacritics(
        (isPosition ? translatePosition(value) : translateValue(value, columnId)).toLowerCase()
      );
      if (!normalizedValue.includes(normalizeDiacritics(listQuery.toLowerCase()))) {
        return false;
      }
    }

    if (showOnlyActive && !selectedValues.includes(value)) {
      return false;
    }

    if (
      columnId === 'league' &&
      showOnlyLdcMatched &&
      !isLdcMatchedLeague(value, getLdcSettings())
    ) {
      return false;
    }

    if (columnId === 'club' && showOnlyPossession) {
      const possession = filterRuntime.getTeamPossession(value);
      return possession !== null && possession !== undefined;
    }

    return true;
  });

  useEffect(() => {
    if (!isOpen || type !== 'range') {
      return;
    }

    const isScore = SCORE_RANGE_COLUMNS.has(columnId);
    const isFeet = FOOT_RANGE_COLUMNS.has(columnId);
    const isSpecial = SPECIAL_RANGE_COLUMNS.has(columnId);
    const step = column?.step ?? (isSpecial || isFeet ? '1' : '0.1');
    setupScrollInput(`range-min-${columnId}`, Number.parseFloat(step), 0);
    setupScrollInput(
      `range-max-${columnId}`,
      Number.parseFloat(step),
      isScore ? 20 : isFeet ? 5 : 0
    );
  }, [column?.step, columnId, isOpen, type]);

  useEffect(() => {
    if (!isOpen) {
      setListQuery('');
      setShowOnlyActive(false);
      setShowOnlyLdcMatched(false);
      setShowOnlyPossession(false);
      return;
    }

    window.setTimeout(() => {
      popupRef.current
        ?.querySelector<HTMLInputElement>(
          `#filter-input-${columnId}, input[type="text"], input[type="number"]`
        )
        ?.focus();
    }, 0);
  }, [columnId, isOpen]);

  const applyCurrentFilter = () => {
    if (type === 'search') {
      const input = document.querySelector<HTMLInputElement>(`#filter-input-${columnId}`);
      applyColumnFilter(columnId, type, { search: input?.value ?? '' });
    } else if (type === 'range') {
      const min = document.querySelector<HTMLInputElement>(`#range-min-${columnId}`);
      const max = document.querySelector<HTMLInputElement>(`#range-max-${columnId}`);
      applyColumnFilter(columnId, type, { max: max?.value ?? '', min: min?.value ?? '' });
    } else {
      applyFilter(columnId, type);
    }
  };

  const resetCurrentFilter = () => {
    resetColumnFilter(columnId);
  };

  const toggleVisibleValues = () => {
    const visibleSet = new Set(filteredValues);
    const allChecked =
      filteredValues.length > 0 && filteredValues.every((value) => selectedValues.includes(value));
    uniqueValues
      .filter((value) => visibleSet.has(value))
      .forEach((value) => {
        if (selectedValues.includes(value) === allChecked) {
          toggleColumnFilterValue(columnId, value);
        }
      });
  };

  const matchedLeagueCount =
    columnId === 'league'
      ? uniqueValues.filter((value) => isLdcMatchedLeague(value, getLdcSettings())).length
      : 0;
  const clubPossessionCount =
    columnId === 'club'
      ? uniqueValues.filter((value) => {
          const possession = filterRuntime.getTeamPossession(value);
          return possession !== null && possession !== undefined;
        }).length
      : 0;
  const isRangeSpecial = SPECIAL_RANGE_COLUMNS.has(columnId);
  const isRangeFeet = FOOT_RANGE_COLUMNS.has(columnId);
  const rangeStep = column?.step ?? (isRangeSpecial || isRangeFeet ? '1' : '0.1');
  const rangeMax = isRangeSpecial ? undefined : isRangeFeet ? 5 : 20;
  const renderListFilter = type === 'checkbox' || type === 'complex';
  const showLeagueMatchedToggle = columnId === 'league';
  const showClubPossessionToggle = columnId === 'club';
  const showActiveToggle = showLeagueMatchedToggle || showClubPossessionToggle;
  const rangeInputClass = cn(
    'input-paper rounded p-1.5 text-xs',
    WIDE_RANGE_COLUMNS.has(columnId) ? 'w-24' : 'w-16'
  );

  return (
    <div
      id={`filter-${columnId}`}
      ref={popupRef}
      className={cn('filter-popup', isOpen && 'show')}
      role="dialog"
      aria-label={`Filtr ${column?.name ?? columnId}`}
      onClick={(event) => event.stopPropagation()}
    >
      {renderListFilter ? (
        <>
          {isComplex ? (
            <>
              <input
                type="text"
                placeholder="Filtruj..."
                className="input-paper mb-2 w-full rounded p-1.5 text-xs"
                value={listQuery}
                onChange={(event) => setListQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    applyCurrentFilter();
                  }
                }}
              />
              <button
                id={`toggle-visible-btn-${columnId}`}
                type="button"
                className="mb-2 block w-full rounded bg-gray-200 px-2 py-1 text-[10px] hover:bg-gray-300"
                data-fm-action="toggleAllVisible"
                data-fm-id={columnId}
                onClick={toggleVisibleValues}
              >
                Zaznacz/odznacz widoczne ({filteredValues.length})
              </button>
              {showLeagueMatchedToggle ? (
                <label className="mb-2 flex cursor-pointer items-center gap-2 rounded border border-gray-200 bg-gray-50 p-2 text-xs text-ink">
                  <input
                    id={`filter-show-ldc-matched-${columnId}`}
                    type="checkbox"
                    checked={showOnlyLdcMatched}
                    onChange={(event) => setShowOnlyLdcMatched(event.target.checked)}
                    className="accent-black"
                  />
                  <span id={`filter-ldc-matched-text-${columnId}`}>
                    Pokaż na liście filtra tylko ligi dopasowane w LDC ({matchedLeagueCount})
                  </span>
                </label>
              ) : null}
              {showClubPossessionToggle ? (
                <label className="mb-2 flex cursor-pointer items-center gap-2 rounded border border-gray-200 bg-gray-50 p-2 text-xs text-ink">
                  <input
                    id={`filter-club-has-possession-${columnId}`}
                    type="checkbox"
                    checked={showOnlyPossession}
                    onChange={(event) => setShowOnlyPossession(event.target.checked)}
                    className="accent-black"
                  />
                  <span id={`filter-club-possession-text-${columnId}`}>
                    Pokaż tylko kluby z przypisanym posiadaniem piłki ({clubPossessionCount})
                  </span>
                </label>
              ) : null}
              {showActiveToggle ? (
                <button
                  id={`show-active-btn-${columnId}`}
                  type="button"
                  className="mb-2 block w-full rounded bg-blue-200 px-2 py-1 text-[10px] hover:bg-blue-300"
                  data-fm-action="toggleShowActiveInFilter"
                  data-fm-id={columnId}
                  onClick={() => setShowOnlyActive((value) => !value)}
                >
                  {showOnlyActive
                    ? `Pokaż na liście wszystkie (${uniqueValues.length})`
                    : `Pokaż na liście tylko aktywne (${selectedValues.length})`}
                </button>
              ) : null}
            </>
          ) : null}
          {isPosition ? (
            <div className="mb-2 rounded border border-gray-200 bg-gray-50 p-2">
              <div className="mb-1.5 text-[10px] font-bold uppercase text-gray-600">
                Logika filtrowania:
              </div>
              <div className="flex gap-3">
                {(['or', 'and'] as const).map((mode) => (
                  <label
                    key={mode}
                    className="flex cursor-pointer items-center gap-1.5 text-xs text-ink"
                  >
                    <input
                      type="radio"
                      name="position-filter-mode"
                      value={mode}
                      checked={legacyTableStore.positionFilterMode === mode}
                      onChange={() => setPositionFilterMode(mode)}
                      className="accent-black"
                    />
                    <span>{mode === 'or' ? 'Lub (OR)' : 'I (AND)'}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <div id={`list-${columnId}`} className="max-h-32 space-y-1 overflow-y-auto">
            {filteredValues.map((value) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 p-1 text-xs text-ink hover:bg-gray-100"
              >
                <input
                  type="checkbox"
                  value={value}
                  checked={selectedValues.includes(value)}
                  onChange={() => toggleColumnFilterValue(columnId, value)}
                  className="font-mono accent-black"
                />
                {isPosition ? translatePosition(value) : translateValue(value, columnId)}
              </label>
            ))}
          </div>
        </>
      ) : null}

      {type === 'range' ? (
        <div className="mb-2 flex gap-2">
          <input
            id={`range-min-${columnId}`}
            type="number"
            defaultValue={rangeValue?.min ?? ''}
            placeholder="Min"
            step={rangeStep}
            min={column?.min === undefined ? 0 : column.min}
            max={rangeMax}
            className={rangeInputClass}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                applyCurrentFilter();
              }
            }}
          />
          <input
            id={`range-max-${columnId}`}
            type="number"
            defaultValue={rangeValue?.max ?? ''}
            placeholder="Max"
            step={rangeStep}
            min={column?.min === undefined ? 0 : column.min}
            max={rangeMax}
            className={rangeInputClass}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                applyCurrentFilter();
              }
            }}
          />
        </div>
      ) : null}

      {type === 'search' ? (
        <input
          id={`filter-input-${columnId}`}
          type="text"
          defaultValue={currentSearchValue}
          placeholder="Szukaj..."
          className="input-paper mb-2 w-full rounded p-1.5 text-xs"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              applyCurrentFilter();
            }
          }}
        />
      ) : null}

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="flex-1 bg-ink py-1.5 text-xs font-bold uppercase text-white hover:bg-gray-800"
          data-fm-action="applyFilter"
          data-fm-id={columnId}
          data-fm-type={type}
          onClick={applyCurrentFilter}
        >
          Zastosuj
        </button>
        <button
          type="button"
          className="bg-gray-200 px-3 py-1.5 text-xs text-ink hover:bg-gray-300"
          data-fm-action="resetColumnFilter"
          data-fm-id={columnId}
          title="Resetuj filtr"
          aria-label="Resetuj filtr"
          onClick={resetCurrentFilter}
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
