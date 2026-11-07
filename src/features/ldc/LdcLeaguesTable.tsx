import { ChevronDown, ChevronUp, ChevronsUpDown, Info } from 'lucide-react';
import { memo, type RefObject } from 'react';

import type { buildLdcLeagueRows } from './ldcTableModel';
import type { LdcSortColumn } from '@/config/ldcConfig';

type LeagueEditableField = 'name' | 'nation' | 'rank' | 'stars';
type LdcLeagueRowModel = ReturnType<typeof buildLdcLeagueRows>[number];

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

const LeagueRow = memo(function LeagueRow({
  countryWarning,
  isHighlighted,
  isSelected,
  onCommitField,
  onCountryInputChange,
  onDelete,
  onMoveDown,
  onMoveUp,
  onToggleSelected,
  row,
  showLdcRaw
}: {
  countryWarning: null | string;
  isHighlighted: boolean;
  isSelected: boolean;
  onCommitField: (leagueId: string, field: LeagueEditableField, value: string) => void;
  onCountryInputChange: (leagueId: string, value: string) => void;
  onDelete: (leagueId: string, leagueName: string) => void;
  onMoveDown: (leagueId: string) => void;
  onMoveUp: (leagueId: string) => void;
  onToggleSelected: (leagueId: string) => void;
  row: LdcLeagueRowModel;
  showLdcRaw: boolean;
}) {
  return (
    <tr
      className={`border-b border-border/20 align-middle hover:bg-accent/5 ${
        isHighlighted ? 'bg-accent/10' : 'odd:bg-background even:bg-surface/20'
      }`}
      data-league-index={String(row.originalIndex)}
      data-row-id={row.rowId}
    >
      <td className="px-2 py-1.5 align-middle">
        <input
          checked={isSelected}
          className="ldc-league-row-checkbox accent-accent"
          data-league-index={String(row.originalIndex)}
          onChange={() => {
            onToggleSelected(row.rowId);
          }}
          type="checkbox"
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          className="w-16 rounded border border-border/35 bg-background px-1 py-0.5 text-center font-mono text-xs"
          data-field="rank"
          data-league-index={String(row.originalIndex)}
          data-row-id={row.rowId}
          defaultValue={String(row.league.rank)}
          key={`rank-${row.league.rank}`}
          min="1"
          onBlur={(event) => {
            onCommitField(row.rowId, 'rank', event.target.value);
          }}
          title="Pozycja ligi na liście. Niższy = lepsza liga"
          type="number"
        />
      </td>
      <td className={`max-w-[18rem] px-2 py-1.5 ${row.errorClassName}`} title={row.league.name}>
        <div className="flex items-center gap-1">
          <input
            className={`w-full truncate rounded border border-border/35 bg-background px-2 py-1 font-sans text-xs ${row.hasErrors ? 'border-red-500' : ''}`}
            data-field="name"
            data-league-index={String(row.originalIndex)}
            data-row-id={row.rowId}
            defaultValue={row.league.name}
            key={`name-${row.league.name}`}
            onBlur={(event) => {
              onCommitField(row.rowId, 'name', event.target.value);
            }}
            title={row.league.name}
            type="text"
          />
          {row.isMatched ? (
            <i
              className="fas fa-check-circle ml-1 text-green-500"
              title="Liga dopasowana do co najmniej jednego zawodnika z załadowanej obecnie bazy piłkarzy"
            />
          ) : null}
          {row.hasErrors ? (
            <i
              className="fas fa-exclamation-triangle ml-1 text-red-500"
              title={row.errorIconTitle}
            />
          ) : null}
        </div>
      </td>
      <td className="px-2 py-1.5">
        <input
          className={`w-full rounded border px-2 py-1 font-sans text-xs ${
            countryWarning === null
              ? 'border-border/35 bg-background'
              : 'border-yellow-400 bg-yellow-50/60'
          }`}
          data-field="nation"
          data-league-index={String(row.originalIndex)}
          data-row-id={row.rowId}
          defaultValue={row.league.nation || ''}
          key={`nation-${row.league.nation || ''}`}
          onInput={(event) => {
            onCountryInputChange(row.rowId, event.currentTarget.value);
          }}
          onBlur={(event) => {
            onCommitField(row.rowId, 'nation', event.target.value);
          }}
          title={countryWarning ?? ''}
          type="text"
        />
        {countryWarning === null ? null : (
          <div className="mt-1 text-[10px] text-yellow-700">{countryWarning}</div>
        )}
      </td>
      {row.league.stars === null ? (
        <td className="px-2 py-1.5 text-text-muted">-</td>
      ) : (
        <td className="px-2 py-1.5">
          <input
            className="w-16 rounded border border-border/35 bg-background px-1 py-1 font-mono text-xs"
            data-field="stars"
            data-league-index={String(row.originalIndex)}
            data-row-id={row.rowId}
            defaultValue={String(row.league.stars)}
            key={`stars-${String(row.league.stars)}`}
            max="5"
            min="0.5"
            onBlur={(event) => {
              onCommitField(row.rowId, 'stars', event.target.value);
            }}
            step="0.5"
            title="Ocena ligi w skali 0.5-5. Używane w modelu koszykowym"
            type="number"
          />
        </td>
      )}
      <td
        className="hidden px-2 py-1.5 font-mono text-[12px] sm:table-cell"
        title="Obliczona siła ligi w skali 0-100"
      >
        {row.inputScoreText}
      </td>
      {showLdcRaw ? (
        <td
          className="hidden px-2 py-1.5 font-mono text-[12px] sm:table-cell"
          title={row.ldcRawTooltip}
        >
          {row.ldcRawText}
        </td>
      ) : null}
      <td className="px-2 py-1.5 font-mono text-[12px] font-semibold" title={row.multiplierTooltip}>
        {row.multiplierText}
      </td>
      <td className="px-2 py-1.5">
        <div className="flex gap-1">
          <button
            className="ldc-move-up rounded-lg border border-border/35 px-2 py-0.5 text-xs text-text-secondary transition hover:bg-surface"
            data-index={String(row.originalIndex)}
            onClick={() => {
              onMoveUp(row.rowId);
            }}
            title="Przenieś w górę"
            type="button"
          >
            ↑
          </button>
          <button
            className="ldc-move-down rounded-lg border border-border/35 px-2 py-0.5 text-xs text-text-secondary transition hover:bg-surface"
            data-index={String(row.originalIndex)}
            onClick={() => {
              onMoveDown(row.rowId);
            }}
            title="Przenieś w dół"
            type="button"
          >
            ↓
          </button>
          <button
            className="ldc-delete rounded-lg border border-border/35 px-2 py-0.5 text-xs text-negative transition hover:bg-negative/10"
            data-index={String(row.originalIndex)}
            onClick={() => {
              onDelete(row.rowId, row.league.name);
            }}
            title="Usuń"
            type="button"
          >
            ×
          </button>
        </div>
      </td>
    </tr>
  );
});

interface LdcLeaguesTableProps {
  allSelected: boolean;
  columnCount: number;
  countryWarnings: Record<string, string>;
  highlightedLeagueIds: string[];
  onCommitField: (leagueId: string, field: LeagueEditableField, rawValue: string) => void;
  onCountryInputChange: (leagueId: string, rawValue: string) => void;
  onDeleteLeague: (leagueId: string, leagueName: string) => void;
  onMoveLeagueDown: (leagueId: string) => void;
  onMoveLeagueUp: (leagueId: string) => void;
  onSelectAllChange: () => void;
  onSortColumn: (column: LdcSortColumn) => void;
  paddingBottom: number;
  paddingTop: number;
  rows: LdcLeagueRowModel[];
  selectedLeagueIds: string[];
  settingsBaseLeague: string;
  shouldVirtualize: boolean;
  showLdcRaw: boolean;
  sortColumn: LdcSortColumn;
  sortDirection: 'asc' | 'desc';
  tableScrollRef: RefObject<HTMLDivElement | null>;
  toggleSelectedLeagueId: (leagueId: string) => void;
  virtualRows: LdcLeagueRowModel[];
}

function renderSortHeader(
  activeColumn: LdcSortColumn,
  direction: 'asc' | 'desc',
  column: LdcSortColumn,
  label: string,
  onSortColumn: (column: LdcSortColumn) => void
) {
  const active = activeColumn === column;

  return (
    <button
      type="button"
      onClick={() => {
        onSortColumn(column);
      }}
      className="flex items-center gap-1 text-left text-text-muted transition hover:text-text-primary"
    >
      <span>{label}</span>
      <SortIndicator active={active} direction={direction} />
    </button>
  );
}

export function LdcLeaguesTable({
  allSelected,
  columnCount,
  countryWarnings,
  highlightedLeagueIds,
  onCommitField,
  onCountryInputChange,
  onDeleteLeague,
  onMoveLeagueDown,
  onMoveLeagueUp,
  onSelectAllChange,
  onSortColumn,
  paddingBottom,
  paddingTop,
  rows,
  selectedLeagueIds,
  settingsBaseLeague,
  shouldVirtualize,
  showLdcRaw,
  sortColumn,
  sortDirection,
  tableScrollRef,
  toggleSelectedLeagueId,
  virtualRows
}: LdcLeaguesTableProps) {
  const highlightedLeagueIdSet = new Set(highlightedLeagueIds);
  const selectedLeagueIdSet = new Set(selectedLeagueIds);

  return (
    <div id="ldc-leagues-scroll" ref={tableScrollRef} className="max-h-[30rem] overflow-auto">
      <table id="ldc-leagues-table" className="w-full text-xs">
        <thead className="sticky top-0 z-[1] bg-background/95 backdrop-blur-sm">
          <tr>
            <th className="border-b border-border/35 px-2 py-2 text-left text-text-muted">
              <input
                id="ldc-select-all"
                title="Zaznacz wszystkie"
                checked={allSelected}
                onChange={onSelectAllChange}
                className="accent-accent"
                type="checkbox"
              />
            </th>
            <th className="border-b border-border/35 px-2 py-2 text-left text-text-muted">
              {renderSortHeader(sortColumn, sortDirection, 'rank', 'Rank', onSortColumn)}
            </th>
            <th className="border-b border-border/35 px-2 py-2 text-left text-text-muted">
              {renderSortHeader(sortColumn, sortDirection, 'name', 'Nazwa', onSortColumn)}
            </th>
            <th className="border-b border-border/35 px-2 py-2 text-left text-text-muted">
              {renderSortHeader(sortColumn, sortDirection, 'nation', 'Kraj', onSortColumn)}
            </th>
            <th
              id="ldc-stars-header"
              className="border-b border-border/35 px-2 py-2 text-left text-text-muted"
            >
              {renderSortHeader(sortColumn, sortDirection, 'stars', 'Gwiazdki', onSortColumn)}
            </th>
            <th className="hidden border-b border-border/35 px-2 py-2 text-left text-text-muted sm:table-cell">
              {renderSortHeader(
                sortColumn,
                sortDirection,
                'inputScore',
                'InputScore',
                onSortColumn
              )}
            </th>
            {showLdcRaw ? (
              <th className="hidden border-b border-border/35 px-2 py-2 text-left text-text-muted sm:table-cell">
                {renderSortHeader(sortColumn, sortDirection, 'ldcRaw', 'LDC_raw', onSortColumn)}
              </th>
            ) : null}
            <th className="border-b border-border/35 px-2 py-2 text-left text-text-muted">
              <div className="flex items-center gap-1">
                {renderSortHeader(
                  sortColumn,
                  sortDirection,
                  'multiplier',
                  'Multiplier',
                  onSortColumn
                )}
                {showLdcRaw ? (
                  <span
                    className="inline-flex cursor-help items-center text-text-muted"
                    title={`Znormalizowano względem: ${settingsBaseLeague}`}
                  >
                    <Info className="h-3 w-3" />
                  </span>
                ) : null}
              </div>
            </th>
            <th className="border-b border-border/35 px-2 py-2 text-right text-text-muted">
              <span className="sr-only">Działania wiersza</span>
            </th>
          </tr>
        </thead>
        <tbody id="ldc-leagues-tbody">
          {paddingTop > 0 ? (
            <tr aria-hidden="true">
              <td colSpan={columnCount} style={{ height: `${paddingTop}px` }} />
            </tr>
          ) : null}
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-sm text-text-muted" colSpan={columnCount}>
                Brak rekordów do wyświetlenia.
              </td>
            </tr>
          ) : null}
          {(shouldVirtualize ? virtualRows : rows).map((row) => (
            <LeagueRow
              key={row.rowId}
              countryWarning={
                Object.hasOwn(countryWarnings, row.rowId)
                  ? (countryWarnings[row.rowId] ?? null)
                  : null
              }
              isHighlighted={highlightedLeagueIdSet.has(row.rowId)}
              isSelected={selectedLeagueIdSet.has(row.rowId)}
              onCommitField={onCommitField}
              onCountryInputChange={onCountryInputChange}
              onDelete={onDeleteLeague}
              onMoveDown={onMoveLeagueDown}
              onMoveUp={onMoveLeagueUp}
              onToggleSelected={toggleSelectedLeagueId}
              row={row}
              showLdcRaw={showLdcRaw}
            />
          ))}
          {paddingBottom > 0 ? (
            <tr aria-hidden="true">
              <td colSpan={columnCount} style={{ height: `${paddingBottom}px` }} />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
