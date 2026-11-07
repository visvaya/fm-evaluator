import { ChevronDown } from 'lucide-react';

import type { LdcLeagueFilter } from './useLdcStore';

interface LdcLeaguesToolbarProps {
  isExpanded: boolean;
  leagueFilter: LdcLeagueFilter;
  onAddLeague: () => void;
  onLeagueFilterChange: (leagueFilter: LdcLeagueFilter) => void;
  onSearchTermChange: (searchTerm: string) => void;
  onToggleExpanded: () => void;
  searchTerm: string;
}

export function LdcLeaguesToolbar({
  isExpanded,
  leagueFilter,
  onAddLeague,
  onLeagueFilterChange,
  onSearchTermChange,
  onToggleExpanded,
  searchTerm
}: LdcLeaguesToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
      <button
        id="ldc-leagues-toggle-btn"
        type="button"
        onClick={onToggleExpanded}
        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted transition hover:text-text-primary"
      >
        <span>Lista lig</span>
        <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
          <ChevronDown className="h-3.5 w-3.5" />
        </span>
      </button>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center rounded-lg border border-border/50 bg-background/80 px-2 py-1">
          <input
            id="ldc-league-search"
            type="text"
            value={searchTerm}
            onChange={(event) => {
              onSearchTermChange(event.target.value);
            }}
            placeholder="Szukaj ligi..."
            className="w-40 bg-transparent px-1.5 py-0.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </div>
        <button
          id="ldc-add-league-btn"
          type="button"
          onClick={onAddLeague}
          className="rounded-lg border border-border/50 bg-background/80 px-3 py-2 text-xs font-semibold text-text-primary transition hover:bg-surface"
        >
          + Dodaj ligę
        </button>
        <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-background/80 px-2 py-1">
          <label className="text-xs text-text-muted" htmlFor="ldc-league-filter">
            Filtruj:
          </label>
          <select
            id="ldc-league-filter"
            value={leagueFilter}
            onChange={(event) => {
              onLeagueFilterChange(event.target.value as LdcLeagueFilter);
            }}
            className="bg-transparent py-0.5 pr-1 text-xs text-text-primary focus:outline-none"
          >
            <option value="all">Wszystkie</option>
            <option value="with-mappings">Z mapowaniami</option>
            <option value="without-mappings">Bez mapowań</option>
            <option value="without-stars">Bez gwiazdek</option>
            <option value="with-problems">Z problemami</option>
          </select>
        </div>
      </div>
    </div>
  );
}
