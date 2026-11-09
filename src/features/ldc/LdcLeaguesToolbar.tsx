import { ChevronDown } from 'lucide-react';

import { useUiText } from '@/hooks/useUiText';

import type { LdcLeagueFilter } from './useLdcStore';
import type { LdcGroupBy } from '@/config/ldcConfig';

interface LdcLeaguesToolbarProps {
  groupBy: LdcGroupBy | null;
  isExpanded: boolean;
  leagueFilter: LdcLeagueFilter;
  onAddLeague: () => void;
  onGroupByChange: (groupBy: LdcGroupBy | null) => void;
  onLeagueFilterChange: (leagueFilter: LdcLeagueFilter) => void;
  onSearchTermChange: (searchTerm: string) => void;
  onToggleExpanded: () => void;
  searchTerm: string;
}

const GROUP_BY_OPTIONS = ['nation', 'stars'] as const satisfies readonly LdcGroupBy[];

export function LdcLeaguesToolbar({
  groupBy,
  isExpanded,
  leagueFilter,
  onAddLeague,
  onGroupByChange,
  onLeagueFilterChange,
  onSearchTermChange,
  onToggleExpanded,
  searchTerm
}: Readonly<LdcLeaguesToolbarProps>) {
  const t = useUiText();
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
        <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-background/80 px-2 py-1">
          <label className="text-xs text-text-muted" htmlFor="ldc-group-by">
            {t('ldc_group_by')}
          </label>
          <select
            id="ldc-group-by"
            value={groupBy ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              onGroupByChange(GROUP_BY_OPTIONS.find((option) => option === value) ?? null);
            }}
            className="bg-transparent py-0.5 pr-1 text-xs text-text-primary focus:outline-none"
          >
            <option value="">{t('ldc_group_by_none')}</option>
            <option value="nation">{t('ldc_group_by_nation')}</option>
            <option value="stars">{t('ldc_group_by_stars')}</option>
          </select>
        </div>
      </div>
    </div>
  );
}
