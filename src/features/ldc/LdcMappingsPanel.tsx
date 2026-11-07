/* eslint-disable sonarjs/no-nested-functions -- Local draft-editing handlers are intentionally kept close to the modal UI during this modal workbench migration. */

import { Redo2, Undo2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { loadLeagueMappings, saveLeagueMappings } from '@/computing/ldcMappings';
import { type LdcMappingTarget } from '@/config/ldcConfig';
import { cn } from '@/lib/utils';
import { checkMissingLeagues } from '@/ui/ldcMissing';
import { showConfirmModal } from '@/ui/ldcModalHelpers';
import { normalizeDiacritics } from '@/utils/helpers';

import { LdcMappingColumnFilterPopover, LdcMappingFilterTrigger } from './LdcMappingFilters';
import {
  buildMappingRecordsSignature,
  buildMappingsFromRecords,
  buildRecordsFromMappings,
  cloneMappingRecords,
  compareMappingRecords,
  EMPTY_MAPPING_FILTERS,
  isMappingFilterActive,
  pushMappingHistory
} from './ldcMappingsModel';
import { LdcMappingTargetPicker } from './LdcMappingTargetPicker';
import { useLdcStore } from './useLdcStore';

import type { MappingFilterPopoverState } from './LdcMappingFilters';
import type { MappingColumn, MappingColumnFilters, MappingRecord } from './ldcMappingsModel';

interface LdcMappingsModalProps {
  isOpen: boolean;
  onRequestClose: () => void;
}

interface MappingPickerState {
  currentTargetKey: null | string;
  sources: string[];
  type: 'bulk' | 'single';
}

type PickerState = MappingPickerState | null;

function normalizeSearchValue(value: string) {
  return normalizeDiacritics(value.toLowerCase().trim());
}

function getTargetKey(name: string, nation: string) {
  return `${name}||${nation}`;
}

export function LdcMappingsModal({ isOpen, onRequestClose }: Readonly<LdcMappingsModalProps>) {
  const settings = useLdcStore((state) => state.settings);
  const syncFromLegacy = useLdcStore((state) => state.syncFromLegacy);
  const [draftMappings, setDraftMappings] = useState<MappingRecord[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [historyStack, setHistoryStack] = useState<MappingRecord[][]>([]);
  const [initialSignature, setInitialSignature] = useState('');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<MappingColumn>('source');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pickerState, setPickerState] = useState<PickerState>(null);
  const [filters, setFilters] = useState<MappingColumnFilters>(EMPTY_MAPPING_FILTERS);
  const [filterPopoverState, setFilterPopoverState] = useState<MappingFilterPopoverState | null>(
    null
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const records = buildRecordsFromMappings(loadLeagueMappings());
    setDraftMappings(records);
    setHistoryIndex(0);
    setHistoryStack([cloneMappingRecords(records)]);
    setInitialSignature(buildMappingRecordsSignature(records));
    setSelectedSources([]);
    setSortColumn('source');
    setSortDirection('asc');
    setPickerState(null);
    setFilters(EMPTY_MAPPING_FILTERS);
    setFilterPopoverState(null);
  }, [isOpen]);

  const targetOptions = useMemo(
    () =>
      settings.leagues
        .map((league) => ({
          key: getTargetKey(league.name, league.nation),
          name: league.name,
          nation: league.nation
        }))
        .toSorted((left, right) =>
          `${left.name} ${left.nation}`.localeCompare(`${right.name} ${right.nation}`)
        ),
    [settings.leagues]
  );

  const availableCountries = useMemo(
    () =>
      [...new Set(targetOptions.map((option) => option.nation).filter(Boolean))].toSorted(
        (left, right) => left.localeCompare(right)
      ),
    [targetOptions]
  );

  const visibleMappings = useMemo(() => {
    const normalizedSourceFilter = normalizeSearchValue(filters.source);
    const normalizedTargetFilter = normalizeSearchValue(filters.targetName);
    const countryFilterSet = new Set(filters.targetNation);
    const filteredMappings = draftMappings.filter((record) => {
      const matchesSource =
        normalizedSourceFilter.length === 0 ||
        normalizeSearchValue(`${record.sourceName} ${record.sourceNation}`).includes(
          normalizedSourceFilter
        );
      const matchesTarget =
        normalizedTargetFilter.length === 0 ||
        normalizeSearchValue(record.targetName).includes(normalizedTargetFilter);
      const matchesCountry =
        countryFilterSet.size === 0 || countryFilterSet.has(record.targetNation);

      return matchesSource && matchesTarget && matchesCountry;
    });

    return filteredMappings.toSorted((left, right) => {
      const primary = compareMappingRecords(left, right, sortColumn);
      if (primary !== 0) {
        return sortDirection === 'asc' ? primary : -primary;
      }

      return left.source.localeCompare(right.source);
    });
  }, [draftMappings, filters, sortColumn, sortDirection]);

  const visibleSources = visibleMappings.map((record) => record.source);
  const selectedSourceSet = useMemo(() => new Set(selectedSources), [selectedSources]);
  const selectedVisibleCount = visibleSources.filter((source) =>
    selectedSourceSet.has(source)
  ).length;
  const allVisibleSelected =
    visibleSources.length > 0 && selectedVisibleCount === visibleSources.length;
  const hasRedo = historyIndex >= 0 && historyIndex < historyStack.length - 1;
  const hasUndo = historyIndex > 0;
  const isDirty = buildMappingRecordsSignature(draftMappings) !== initialSignature;

  const updateDraftMappings = (updater: (current: MappingRecord[]) => MappingRecord[]) => {
    setDraftMappings((current) => {
      const nextDraft = cloneMappingRecords(updater(current));
      const history = pushMappingHistory(historyStack, historyIndex, nextDraft);
      setHistoryIndex(history.historyIndex);
      setHistoryStack(history.historyStack);
      setSelectedSources((currentSelection) =>
        currentSelection.filter((source) => nextDraft.some((record) => record.source === source))
      );
      return nextDraft;
    });
  };

  const requestClose = () => {
    if (!isDirty) {
      onRequestClose();
      return;
    }

    showConfirmModal(
      'Odrzucić niezapisane zmiany?',
      'Zmiany w mapowaniach nie zostały jeszcze zastosowane i zostaną utracone.',
      () => {
        onRequestClose();
      }
    );
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedSources((current) => current.filter((source) => !visibleSources.includes(source)));
      return;
    }

    setSelectedSources((current) => [...new Set([...current, ...visibleSources])]);
  };

  const handleSortColumn = (column: MappingColumn) => {
    if (sortColumn === column) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortColumn(column);
    setSortDirection('asc');
  };

  const applyTargetToSources = (sources: string[], target: LdcMappingTarget) => {
    updateDraftMappings((current) =>
      current.map((record) =>
        sources.includes(record.source)
          ? {
              ...record,
              targetName: target.name,
              targetNation: target.nation
            }
          : record
      )
    );
    setPickerState(null);
  };

  const handleApply = async () => {
    saveLeagueMappings(buildMappingsFromRecords(draftMappings));
    await syncFromLegacy();
    checkMissingLeagues();
    onRequestClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      id="ldc-mappings-modal"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 p-4"
    >
      <div className="relative flex max-h-[80vh] w-full max-w-6xl flex-col rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              Zarządzanie mapowaniami lig
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              Mapowania pozwalają automatycznie dopasowywać ligi z danych zawodników do lig w LDC.
            </p>
          </div>
          <button
            id="ldc-mappings-close"
            type="button"
            onClick={requestClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border text-text-secondary transition hover:bg-surface hover:text-text-primary"
            aria-label="Anuluj"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="custom-scroll flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface/20 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
              <span className="font-medium text-text-secondary">
                {draftMappings.length} mapowań
              </span>
              {selectedSources.length > 0 ? (
                <span className="text-text-secondary">{selectedSources.length} zaznaczonych</span>
              ) : null}
            </div>
            {selectedSources.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  id="ldc-mappings-bulk-target-btn"
                  type="button"
                  onClick={() => {
                    setPickerState({
                      currentTargetKey: null,
                      sources: selectedSources,
                      type: 'bulk'
                    });
                  }}
                  className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-primary transition hover:bg-surface"
                >
                  Zmień ligę LDC dla zaznaczonych
                </button>
                <button
                  id="ldc-mappings-bulk-delete-btn"
                  type="button"
                  onClick={() => {
                    updateDraftMappings((current) =>
                      current.filter((record) => !selectedSourceSet.has(record.source))
                    );
                  }}
                  className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-negative transition hover:bg-negative/10"
                >
                  Usuń zaznaczone
                </button>
              </div>
            ) : null}
          </div>

          <div
            id="ldc-mappings-list"
            className="overflow-hidden rounded-xl border border-border bg-background"
          >
            <table className="min-w-full border-collapse text-xs">
              <thead className="bg-surface/35 text-text-muted">
                <tr className="border-b border-border/40">
                  <th className="w-12 px-4 py-2 text-left">
                    <input
                      id="ldc-mappings-select-all"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      type="checkbox"
                      className="accent-accent"
                    />
                  </th>
                  <th className="px-4 py-2 text-left">
                    <LdcMappingFilterTrigger
                      active={isMappingFilterActive(filters, 'source')}
                      label="Liga źródłowa"
                      onOpenFilter={(event) => {
                        setFilterPopoverState({
                          anchorRect: event.currentTarget.getBoundingClientRect(),
                          column: 'source'
                        });
                      }}
                      onSort={() => {
                        handleSortColumn('source');
                      }}
                      sortActive={sortColumn === 'source'}
                      sortDirection={sortDirection}
                    />
                  </th>
                  <th className="px-4 py-2 text-left">
                    <LdcMappingFilterTrigger
                      active={isMappingFilterActive(filters, 'targetName')}
                      label="Liga LDC"
                      onOpenFilter={(event) => {
                        setFilterPopoverState({
                          anchorRect: event.currentTarget.getBoundingClientRect(),
                          column: 'targetName'
                        });
                      }}
                      onSort={() => {
                        handleSortColumn('targetName');
                      }}
                      sortActive={sortColumn === 'targetName'}
                      sortDirection={sortDirection}
                    />
                  </th>
                  <th className="px-4 py-2 text-left">
                    <LdcMappingFilterTrigger
                      active={isMappingFilterActive(filters, 'targetNation')}
                      label="Kraj LDC"
                      onOpenFilter={(event) => {
                        setFilterPopoverState({
                          anchorRect: event.currentTarget.getBoundingClientRect(),
                          column: 'targetNation'
                        });
                      }}
                      onSort={() => {
                        handleSortColumn('targetNation');
                      }}
                      sortActive={sortColumn === 'targetNation'}
                      sortDirection={sortDirection}
                    />
                  </th>
                  <th className="w-[14rem] px-4 py-2 text-left text-text-muted">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {visibleMappings.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center" colSpan={5}>
                      {draftMappings.length === 0 ? (
                        <>
                          <p className="text-sm font-medium text-text-secondary">
                            Brak zapisanych mapowań
                          </p>
                          <p className="mt-1 text-xs text-text-muted">
                            Mapowania powstają głównie przez Brakujące ligi albo import ustawień
                            LDC.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-text-secondary">Brak wyników</p>
                          <p className="mt-1 text-xs text-text-muted">
                            Zmień aktywne filtry kolumnowe, aby zobaczyć ukryte mapowania.
                          </p>
                        </>
                      )}
                    </td>
                  </tr>
                ) : (
                  visibleMappings.map((record) => {
                    const isSelected = selectedSourceSet.has(record.source);

                    return (
                      <tr
                        key={record.source}
                        className={cn(
                          'border-b border-border/20 align-middle hover:bg-accent/5',
                          isSelected ? 'bg-accent/10' : 'odd:bg-background even:bg-surface/15'
                        )}
                      >
                        <td className="px-4 py-2 align-middle">
                          <input
                            checked={isSelected}
                            onChange={() => {
                              setSelectedSources((current) =>
                                current.includes(record.source)
                                  ? current.filter((source) => source !== record.source)
                                  : [...current, record.source]
                              );
                            }}
                            type="checkbox"
                            className="accent-accent"
                          />
                        </td>
                        <td className="px-4 py-2 text-sm text-text-primary">
                          <span className="block">{record.sourceName}</span>
                          {record.sourceNation ? (
                            <span className="mt-0.5 block text-xs text-text-muted">
                              {record.sourceNation}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 text-sm text-text-primary">{record.targetName}</td>
                        <td className="px-4 py-2 text-sm text-text-secondary">
                          {record.targetNation || 'Bez kraju'}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="ldc-edit-mapping-btn rounded-xl border border-border px-3 py-1.5 text-[11px] font-medium text-text-primary transition hover:bg-surface"
                              data-original={record.source}
                              onClick={() => {
                                setPickerState({
                                  currentTargetKey: getTargetKey(
                                    record.targetName,
                                    record.targetNation
                                  ),
                                  sources: [record.source],
                                  type: 'single'
                                });
                              }}
                            >
                              Zmień ligę LDC
                            </button>
                            <button
                              type="button"
                              className="ldc-remove-mapping-btn rounded-xl border border-border px-3 py-1.5 text-[11px] font-medium text-negative transition hover:bg-negative/10"
                              data-original={record.source}
                              onClick={() => {
                                updateDraftMappings((current) =>
                                  current.filter((entry) => entry.source !== record.source)
                                );
                              }}
                            >
                              Usuń
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3">
          <div className="flex gap-2">
            <button
              id="ldc-mappings-undo"
              type="button"
              disabled={!hasUndo}
              onClick={() => {
                if (!hasUndo) {
                  return;
                }

                const nextIndex = historyIndex - 1;
                const snapshot = cloneMappingRecords(historyStack[nextIndex] ?? []);
                setHistoryIndex(nextIndex);
                setDraftMappings(snapshot);
                setSelectedSources((current) =>
                  current.filter((source) => snapshot.some((record) => record.source === source))
                );
              }}
              className="inline-flex items-center rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Undo2 className="mr-1 h-3.5 w-3.5" /> Cofnij
            </button>
            <button
              id="ldc-mappings-redo"
              type="button"
              disabled={!hasRedo}
              onClick={() => {
                if (!hasRedo) {
                  return;
                }

                const nextIndex = historyIndex + 1;
                const snapshot = cloneMappingRecords(historyStack[nextIndex] ?? []);
                setHistoryIndex(nextIndex);
                setDraftMappings(snapshot);
                setSelectedSources((current) =>
                  current.filter((source) => snapshot.some((record) => record.source === source))
                );
              }}
              className="inline-flex items-center rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Redo2 className="mr-1 h-3.5 w-3.5" /> Ponów
            </button>
          </div>
          <div className="flex gap-2">
            <button
              id="ldc-mappings-cancel"
              type="button"
              onClick={requestClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-text-primary transition hover:bg-surface"
            >
              Anuluj
            </button>
            <button
              id="ldc-mappings-apply"
              type="button"
              disabled={!isDirty}
              onClick={() => {
                void handleApply();
              }}
              className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Zastosuj
            </button>
          </div>
        </div>

        {pickerState === null ? null : (
          <LdcMappingTargetPicker
            currentTargetKey={pickerState.currentTargetKey}
            onApply={(targetLeague) => {
              applyTargetToSources(pickerState.sources, targetLeague);
            }}
            onCancel={() => {
              setPickerState(null);
            }}
            options={targetOptions}
            sources={pickerState.sources.map((source) => {
              const record = draftMappings.find((entry) => entry.source === source);
              return record?.sourceNation
                ? `${record.sourceName} (${record.sourceNation})`
                : (record?.sourceName ?? source);
            })}
            type={pickerState.type}
          />
        )}

        {filterPopoverState ? (
          <LdcMappingColumnFilterPopover
            countries={availableCountries}
            filters={filters}
            onClose={() => {
              setFilterPopoverState(null);
            }}
            onUpdateFilters={(updater) => {
              setFilters((current) => updater(current));
            }}
            state={filterPopoverState}
          />
        ) : null}
      </div>
    </div>
  );
}
