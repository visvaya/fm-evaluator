/* eslint-disable sonarjs/no-nested-functions -- Filter controls use local checkbox updaters. */

import { ChevronDown, ChevronUp, ChevronsUpDown, Filter } from 'lucide-react';
import {
  type MouseEvent as ReactMouseEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';
import { normalizeDiacritics } from '@/utils/helpers';

import type { MappingColumn, MappingColumnFilters } from './ldcMappingsModel';

export interface MappingFilterPopoverState {
  anchorRect: DOMRect;
  column: MappingColumn;
}

function normalizeSearchValue(value: string) {
  return normalizeDiacritics(value.toLowerCase().trim());
}

function SortIndicator({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  if (!active) {
    return <ChevronsUpDown className="h-3.5 w-3.5 text-text-muted/70" />;
  }

  return direction === 'asc' ? (
    <ChevronUp className="h-3.5 w-3.5 text-text-primary" />
  ) : (
    <ChevronDown className="h-3.5 w-3.5 text-text-primary" />
  );
}

export function LdcMappingFilterTrigger({
  active,
  label,
  sortActive,
  sortDirection,
  onOpenFilter,
  onSort
}: {
  active: boolean;
  label: string;
  onOpenFilter: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onSort: () => void;
  sortActive: boolean;
  sortDirection: 'asc' | 'desc';
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        className="flex items-center gap-1 text-left text-text-muted transition hover:text-text-primary"
        onClick={onSort}
        type="button"
      >
        <span>{label}</span>
        <SortIndicator active={sortActive} direction={sortDirection} />
      </button>
      <button
        aria-label={`Filtruj kolumnę ${label}`}
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded-md border transition',
          active
            ? 'border-accent/40 bg-accent/10 text-accent'
            : 'border-transparent text-text-muted hover:border-border hover:bg-surface hover:text-text-primary'
        )}
        onClick={onOpenFilter}
        type="button"
      >
        <Filter className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function LdcMappingColumnFilterPopover({
  countries,
  filters,
  onClose,
  onUpdateFilters,
  state
}: {
  countries: string[];
  filters: MappingColumnFilters;
  onClose: () => void;
  onUpdateFilters: (updater: (current: MappingColumnFilters) => MappingColumnFilters) => void;
  state: MappingFilterPopoverState;
}) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<null | Record<string, number | string>>(null);
  const [countryQuery, setCountryQuery] = useState('');

  useLayoutEffect(() => {
    const updatePosition = () => {
      const viewportPadding = 12;
      const width = state.column === 'targetNation' ? 260 : 240;
      const estimatedHeight = state.column === 'targetNation' ? 320 : 150;
      const spaceBelow = window.innerHeight - state.anchorRect.bottom - viewportPadding;
      const spaceAbove = state.anchorRect.top - viewportPadding;
      const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
      const left = Math.min(
        Math.max(viewportPadding, state.anchorRect.left),
        window.innerWidth - width - viewportPadding
      );
      const top = openUpward
        ? Math.max(viewportPadding, state.anchorRect.top - estimatedHeight - 8)
        : state.anchorRect.bottom + 8;
      setStyle({
        left,
        maxHeight: Math.max(160, openUpward ? spaceAbove - 8 : spaceBelow - 8),
        top,
        width
      });
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    updatePosition();
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [onClose, state.anchorRect, state.column]);

  const normalizedCountryQuery = normalizeSearchValue(countryQuery);
  const visibleCountries = useMemo(
    () =>
      normalizedCountryQuery
        ? countries.filter((country) =>
            normalizeSearchValue(country).includes(normalizedCountryQuery)
          )
        : countries,
    [countries, normalizedCountryQuery]
  );

  if (!style) {
    return null;
  }

  const content =
    state.column === 'targetNation' ? (
      <div className="space-y-2">
        <input
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
          id="ldc-mappings-filter-targetNation"
          onChange={(event) => setCountryQuery(event.target.value)}
          placeholder="Filtruj kraje..."
          type="text"
          value={countryQuery}
        />
        <div className="custom-scroll max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border bg-background p-2">
          {visibleCountries.map((country) => {
            const checked = filters.targetNation.includes(country);
            return (
              <label
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-primary hover:bg-surface"
                key={country}
              >
                <input
                  checked={checked}
                  className="accent-accent"
                  onChange={() => {
                    onUpdateFilters((current) => ({
                      ...current,
                      targetNation: checked
                        ? current.targetNation.filter((value) => value !== country)
                        : [...current.targetNation, country]
                    }));
                  }}
                  type="checkbox"
                />
                <span>{country || 'Bez kraju'}</span>
              </label>
            );
          })}
        </div>
      </div>
    ) : (
      <input
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
        id={`ldc-mappings-filter-${state.column}`}
        onChange={(event) => {
          const nextValue = event.target.value;
          onUpdateFilters((current) => ({ ...current, [state.column]: nextValue }));
        }}
        placeholder={state.column === 'source' ? 'Filtruj ligę źródłową...' : 'Filtruj ligę LDC...'}
        type="text"
        value={filters[state.column]}
      />
    );

  return createPortal(
    <div
      className="fixed z-[140] rounded-xl border border-border bg-background p-3 shadow-2xl"
      ref={popoverRef}
      style={style}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-text-primary">Filtr</span>
        <button
          className="text-[11px] font-medium text-text-muted transition hover:text-text-primary"
          onClick={() => {
            onUpdateFilters((current) => ({
              ...current,
              [state.column]: state.column === 'targetNation' ? [] : ''
            }));
            setCountryQuery('');
          }}
          type="button"
        >
          Wyczyść
        </button>
      </div>
      {content}
    </div>,
    document.body
  );
}
