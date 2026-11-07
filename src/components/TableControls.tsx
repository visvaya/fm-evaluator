import { Play, RotateCcw, Search } from 'lucide-react';

import { ENGINE_OPTIONS, type EngineId, type MergeMode } from '@/config/engines';
import { ALL_ROLES } from '@/config/scoreConfig';
import { useDataBoundary } from '@/hooks/useDataBoundary';
import { useUiText } from '@/hooks/useUiText';
import { useTableStore } from '@/store/useTableStore';

export const TableControls = () => {
  const t = useUiText();
  const {
    clearFilters,
    currentEngine,
    currentPosition,
    data,
    filteredData,
    mergeMode,
    searchQuery,
    setEngine,
    setMergeMode,
    setPosition,
    setSearchQuery
  } = useTableStore();
  const { runAnalysis } = useDataBoundary();

  const canAnalyze = data.length > 0 && currentPosition.length > 0;
  const resultsSummary = t('showing_results', 'ui', {
    count: filteredData.length,
    total: data.length
  });

  return (
    <div className="grid gap-4 py-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            {t('scoring_engine')}
          </span>
          <select
            id="engine-select"
            value={currentEngine}
            onChange={(event) => setEngine(event.target.value as EngineId)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium"
          >
            {ENGINE_OPTIONS.map((engine) => (
              <option key={engine.id} value={engine.id}>
                {t(engine.id, 'engines')}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            {t('select_role')}
          </span>
          <select
            id="position-select"
            value={currentPosition}
            onChange={(event) => setPosition(event.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium"
          >
            <option value="">{t('select_role')}</option>
            {ALL_ROLES.map((role) => (
              <option key={role} value={role}>
                {t(role, 'positions')}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            {t('merge_mode')}
          </span>
          <select
            value={mergeMode}
            onChange={(event) => setMergeMode(event.target.value as MergeMode)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium"
          >
            <option value="merge">{t('merge_mode_combine')}</option>
            <option value="replace">{t('merge_mode_replace')}</option>
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            {t('search')}
          </span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-border bg-background py-2 pl-10 pr-3 text-sm"
              placeholder={t('search_players')}
            />
          </div>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          id="run-analysis"
          type="button"
          onClick={() => runAnalysis(currentEngine, currentPosition)}
          disabled={!canAnalyze}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-border"
        >
          <Play className="h-4 w-4" />
          <span>{t('analyze')}</span>
        </button>

        <button
          id="clear-all-filters"
          type="button"
          onClick={clearFilters}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-surface"
        >
          <RotateCcw className="h-4 w-4" />
          <span>{t('reset_filters')}</span>
        </button>

        <div
          id="react-pagination-controls"
          className="flex items-center gap-2 text-sm text-text-secondary"
        >
          <span id="react-results-count" className="font-semibold text-text-primary">
            {resultsSummary}
          </span>
        </div>
      </div>
    </div>
  );
};
