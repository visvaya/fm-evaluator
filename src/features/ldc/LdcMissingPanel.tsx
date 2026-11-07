/* eslint-disable fp/no-mutation, perfectionist/sort-interfaces, sonarjs/cognitive-complexity, sonarjs/no-nested-functions, unicorn/no-negated-condition */

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { addLeagueMapping, createLeagueIdentityKey } from '@/computing/ldcMappings';
import { ldcSettings } from '@/config/ldcConfig';
import {
  buildMissingLeagueRecheckSummary,
  type MissingLeagueCandidate,
  type MissingLeagueCountryGroup,
  type MissingLeagueSubGroup
} from '@/features/ldc/missingLeaguesModel';
import { useLdcMissingStore } from '@/features/ldc/useLdcMissingStore';
import { cn } from '@/lib/utils';
import { addLeagueWithValues, checkMissingLeagues, detectMissingLeagues } from '@/ui/ldcMissing';
import { showAlertModal, showConfirmModal } from '@/ui/ldcModalHelpers';

function getToneClasses(tone: 'neutral' | 'positive' | 'warning') {
  if (tone === 'positive') {
    return 'text-green-700';
  }

  if (tone === 'warning') {
    return 'text-orange-700';
  }

  return 'text-text-secondary';
}

const PRIMARY_BUTTON_CLASS =
  'rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50';
const SECONDARY_BUTTON_CLASS =
  'rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-primary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50';

function SummaryChip({ label }: Readonly<{ label: string }>) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-text-secondary">
      {label}
    </span>
  );
}

function getMissingPanelTriggerLabel(isRechecking: boolean, missingCount: number) {
  if (isRechecking) {
    return 'Sprawdzanie...';
  }

  return missingCount > 0 ? `Brakujące ligi (${missingCount})` : 'Brakujące ligi';
}

function getSelectedLeagues(
  groups: MissingLeagueCountryGroup[],
  selectedLeagueNames: string[]
): MissingLeagueCandidate[] {
  const selectedSet = new Set(selectedLeagueNames);
  return groups.flatMap((group) =>
    group.subGroups.flatMap((subGroup) =>
      subGroup.leagues.filter((league) =>
        selectedSet.has(createLeagueIdentityKey(league.name, league.nation))
      )
    )
  );
}

function confirmAddLeague(league: MissingLeagueCandidate) {
  const openAddDialog = useLdcMissingStore.getState().openAddDialog;
  const stars = league.suggestedStars || null;
  const rank = league.suggestedRank || ldcSettings.leagues.length + 1;
  const suggestionText = stars === null ? `rank: ${rank}` : `gwiazdki: ${stars}, rank: ${rank}`;

  showConfirmModal(
    `Dodaj ligę "${league.name}"`,
    `Czy chcesz dodać ligę z sugerowanymi wartościami (${suggestionText}), czy dostosować ręcznie?`,
    () => {
      addLeagueWithValues(league.name, league.nation || '', stars, rank);
    },
    () => {
      openAddDialog(league);
    }
  );
}

function useCleanExpandedKeys(groups: MissingLeagueCountryGroup[]) {
  const [expandedCountryKeys, setExpandedCountryKeys] = useState<string[]>([]);
  const [expandedSubGroupKeys, setExpandedSubGroupKeys] = useState<string[]>([]);

  useEffect(() => {
    const validCountryKeys = new Set(groups.map((group) => group.key));
    const validSubGroupKeys = new Set(
      groups.flatMap((group) => group.subGroups.map((sub) => sub.key))
    );

    setExpandedCountryKeys((keys) => keys.filter((key) => validCountryKeys.has(key)));
    setExpandedSubGroupKeys((keys) => keys.filter((key) => validSubGroupKeys.has(key)));
  }, [groups]);

  return {
    expandedCountryKeys,
    expandedSubGroupKeys,
    setExpandedCountryKeys,
    setExpandedSubGroupKeys
  };
}

interface MissingLeagueRowProps {
  isSelected: boolean;
  onAdd: () => void;
  onAutoMatch: () => void;
  onManualMatch: () => void;
  onToggleSelection: () => void;
  league: MissingLeagueCandidate;
  levelClassName?: string;
}

function MissingLeagueRow({
  isSelected,
  league,
  levelClassName = 'pl-10',
  onAdd,
  onAutoMatch,
  onManualMatch,
  onToggleSelection
}: Readonly<MissingLeagueRowProps>) {
  const hasMatch = league.suggestedMatch !== null;
  const scorePercent =
    league.matchScore === null ? null : `${((1 - league.matchScore) * 100).toFixed(0)}%`;

  return (
    <div
      className={cn(
        'border-x border-b border-border bg-background px-3 py-2 first:rounded-t-lg first:border-t last:rounded-b-lg',
        levelClassName
      )}
      data-league-index={league.name}
      data-league-name={league.name}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 items-start gap-2">
          <input
            checked={isSelected}
            className="ldc-league-checkbox mt-0.5"
            data-league-index={league.name}
            data-league-name={league.name}
            onChange={onToggleSelection}
            title="Zaznacz ligę"
            type="checkbox"
          />
          <div className="flex-1">
            <strong>{league.name}</strong>
            {league.normalized && league.normalized !== league.name ? (
              <div className="mt-1 text-[10px] text-gray-500">
                Znormalizowana: &quot;{league.normalized}&quot;
              </div>
            ) : null}
            {hasMatch && league.matchType === 'normalized' ? (
              <div className="mt-1">
                <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                  Znormalizowano do &quot;{league.suggestedMatch?.name}&quot;
                </span>
              </div>
            ) : null}
            {hasMatch && league.matchType === 'fuzzy' ? (
              <div className="mt-1">
                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                  Sugerowane dopasowanie: &quot;{league.suggestedMatch?.name}&quot;
                  {scorePercent ? ` • ${scorePercent}` : ''}
                </span>
              </div>
            ) : null}
            {!hasMatch ? (
              <div className="mt-1 text-xs text-text-muted">
                {league.suggestedStars === null
                  ? null
                  : `Sugerowane gwiazdki: ${league.suggestedStars}`}
                {league.suggestedStars === null || !league.suggestedRank ? null : ' • '}
                {league.suggestedRank ? `Sugerowany rank: ${league.suggestedRank}` : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className="ml-2 flex gap-1">
          {hasMatch ? (
            <button
              className="ldc-auto-match-btn rounded-xl bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-accent-hover"
              data-ldc-name={league.suggestedMatch?.name}
              data-original={league.name}
              onClick={onAutoMatch}
              title={`Dopasuj automatycznie do ${league.suggestedMatch?.name}`}
              type="button"
            >
              Dopasuj automatycznie
            </button>
          ) : null}
          <button
            className="ldc-manual-match-btn rounded-xl border border-border px-2.5 py-1.5 text-[11px] font-semibold text-text-primary transition hover:bg-surface"
            data-original={league.name}
            onClick={onManualMatch}
            title="Wybierz ligę ręcznie"
            type="button"
          >
            Wybierz ligę LDC
          </button>
          <button
            className="ldc-add-new-btn rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-100"
            data-nation={league.nation}
            data-original={league.name}
            data-rank={league.suggestedRank || ''}
            data-stars={league.suggestedStars ?? ''}
            onClick={onAdd}
            title="Dodaj jako nową ligę"
            type="button"
          >
            Dodaj jako nową
          </button>
        </div>
      </div>
    </div>
  );
}

interface CountryGroupSectionProps {
  countryGroup: MissingLeagueCountryGroup;
  countryIndex: number;
  expandedCountryKeys: string[];
  expandedSubGroupKeys: string[];
  onOpenBulkAddDialog: (leagues: MissingLeagueCandidate[], title: string, country: string) => void;
  onOpenMatchDialog: (leagues: MissingLeagueCandidate[], title: string, country: string) => void;
  onToggleCountryExpanded: (countryKey: string) => void;
  onToggleLeagueSelection: (league: MissingLeagueCandidate) => void;
  onToggleSubGroupExpanded: (subGroupKey: string) => void;
  selectedLeagueNames: Set<string>;
  setSelectedLeagueNames: (selectedLeagueNames: string[]) => void;
}

function CountryGroupSection({
  countryGroup,
  countryIndex,
  expandedCountryKeys,
  expandedSubGroupKeys,
  onOpenBulkAddDialog,
  onOpenMatchDialog,
  onToggleCountryExpanded,
  onToggleLeagueSelection,
  onToggleSubGroupExpanded,
  selectedLeagueNames,
  setSelectedLeagueNames
}: Readonly<CountryGroupSectionProps>) {
  const isExpanded = expandedCountryKeys.includes(countryGroup.key);
  const allSelected = countryGroup.leagues.every((league) =>
    selectedLeagueNames.has(createLeagueIdentityKey(league.name, league.nation))
  );
  const someSelected = countryGroup.leagues.some((league) =>
    selectedLeagueNames.has(createLeagueIdentityKey(league.name, league.nation))
  );

  return (
    <div>
      {countryIndex > 0 ? <hr className="my-1 border-border/40" /> : null}
      <div className={countryIndex === 0 ? 'mb-1 mt-0' : 'mb-2'}>
        <div className="rounded-lg border border-border bg-background px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                checked={allSelected}
                className="ldc-country-checkbox"
                onChange={() => {
                  if (allSelected) {
                    setSelectedLeagueNames(
                      [...selectedLeagueNames].filter(
                        (leagueKey) =>
                          !countryGroup.leagues.some(
                            (league) =>
                              createLeagueIdentityKey(league.name, league.nation) === leagueKey
                          )
                      )
                    );
                    return;
                  }
                  setSelectedLeagueNames([
                    ...selectedLeagueNames,
                    ...countryGroup.leagues.map((league) =>
                      createLeagueIdentityKey(league.name, league.nation)
                    )
                  ]);
                }}
                ref={(element) => {
                  if (element) {
                    element.indeterminate = !allSelected && someSelected;
                  }
                }}
                title="Zaznacz wszystkie ligi w kraju"
                type="checkbox"
              />
              <button
                className="flex items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition hover:bg-surface"
                onClick={() => onToggleCountryExpanded(countryGroup.key)}
                type="button"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
                )}
                <span className="text-sm font-semibold text-text-primary">
                  {countryGroup.country}
                </span>
                <span className="text-xs text-text-muted">{countryGroup.leagues.length} lig</span>
              </button>
            </div>
            <div className="flex gap-1">
              <button
                className="ldc-group-select-btn rounded-xl border border-border px-2.5 py-1.5 text-[11px] font-semibold text-text-primary transition hover:bg-surface"
                onClick={() =>
                  onOpenMatchDialog(
                    countryGroup.leagues,
                    `Wybierz ligę z LDC dla ${countryGroup.leagues.length} lig z ${countryGroup.country}`,
                    countryGroup.country
                  )
                }
                title="Wybierz ligę dla wszystkich lig w kraju"
                type="button"
              >
                Wybierz ligę LDC
              </button>
              <button
                className="ldc-group-add-btn rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-100"
                onClick={() =>
                  onOpenBulkAddDialog(
                    countryGroup.leagues,
                    `Dostosuj dodawanie lig (${countryGroup.country})`,
                    countryGroup.country
                  )
                }
                title="Dodaj wszystkie ligi z kraju"
                type="button"
              >
                Dodaj jako nowe
              </button>
            </div>
          </div>
        </div>

        {isExpanded ? (
          <div className="mt-0.5 bg-surface/10 px-2 py-1">
            {countryGroup.subGroups.map((subGroup) => (
              <SubGroupSection
                expandedSubGroupKeys={expandedSubGroupKeys}
                key={subGroup.key}
                onAutoMatchGroup={(group) => {
                  const targetLeague = group.leagues[0]?.suggestedMatch;
                  if (!targetLeague) {
                    return;
                  }
                  group.leagues.forEach((league) => {
                    addLeagueMapping(
                      { name: league.name, nation: league.nation },
                      {
                        name: targetLeague.name,
                        nation: targetLeague.nation ?? ''
                      }
                    );
                  });
                  checkMissingLeagues();
                }}
                onOpenGroupAdd={(group, country) =>
                  onOpenBulkAddDialog(group.leagues, `Dostosuj dodawanie lig (${country})`, country)
                }
                onOpenGroupMatch={(leagues, country) =>
                  onOpenMatchDialog(
                    leagues,
                    `Wybierz ligę z LDC dla ${leagues.length} lig z ${country}`,
                    country
                  )
                }
                onOpenManualMatch={(league) =>
                  onOpenMatchDialog(
                    [league],
                    `Wybierz ligę z LDC dla "${league.name}"`,
                    league.nation || ''
                  )
                }
                onToggleExpanded={onToggleSubGroupExpanded}
                onToggleSelection={onToggleLeagueSelection}
                selectedLeagueNames={selectedLeagueNames}
                setSelectedLeagueNames={setSelectedLeagueNames}
                subGroup={subGroup}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface SubGroupSectionProps {
  expandedSubGroupKeys: string[];
  onAutoMatchGroup: (subGroup: MissingLeagueSubGroup) => void;
  onOpenGroupAdd: (subGroup: MissingLeagueSubGroup, country: string) => void;
  onOpenGroupMatch: (leagues: MissingLeagueCandidate[], country: string) => void;
  onOpenManualMatch: (league: MissingLeagueCandidate) => void;
  onToggleExpanded: (key: string) => void;
  onToggleSelection: (league: MissingLeagueCandidate) => void;
  selectedLeagueNames: Set<string>;
  setSelectedLeagueNames: (selectedLeagueNames: string[]) => void;
  subGroup: MissingLeagueSubGroup;
}

function SubGroupSection({
  expandedSubGroupKeys,
  onAutoMatchGroup,
  onOpenGroupAdd,
  onOpenGroupMatch,
  onOpenManualMatch,
  onToggleExpanded,
  onToggleSelection,
  selectedLeagueNames,
  setSelectedLeagueNames,
  subGroup
}: Readonly<SubGroupSectionProps>) {
  if (subGroup.normalizedName === null && subGroup.leagues.length === 1) {
    const league = subGroup.leagues[0];
    return (
      <MissingLeagueRow
        isSelected={selectedLeagueNames.has(createLeagueIdentityKey(league.name, league.nation))}
        league={league}
        levelClassName="pl-5"
        onAdd={() => confirmAddLeague(league)}
        onAutoMatch={() => {
          if (!league.suggestedMatch) {
            return;
          }
          addLeagueMapping(
            { name: league.name, nation: league.nation },
            {
              name: league.suggestedMatch.name,
              nation: league.suggestedMatch.nation ?? ''
            }
          );
          checkMissingLeagues();
        }}
        onManualMatch={() => onOpenManualMatch(league)}
        onToggleSelection={() => onToggleSelection(league)}
      />
    );
  }

  const isExpanded = expandedSubGroupKeys.includes(subGroup.key);
  const allSelected = subGroup.leagues.every((league) =>
    selectedLeagueNames.has(createLeagueIdentityKey(league.name, league.nation))
  );
  const someSelected = subGroup.leagues.some((league) =>
    selectedLeagueNames.has(createLeagueIdentityKey(league.name, league.nation))
  );
  const allHaveSameMatch =
    subGroup.leagues.every((league) => league.suggestedMatch !== null) &&
    Boolean(subGroup.leagues[0]?.suggestedMatch?.name) &&
    subGroup.leagues.every(
      (league) => league.suggestedMatch?.name === subGroup.leagues[0]?.suggestedMatch?.name
    );

  return (
    <div className="mb-0.5 pl-3">
      <div className="rounded-lg border border-border bg-background/80 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              checked={allSelected}
              className="ldc-subgroup-checkbox"
              onChange={() => {
                if (allSelected) {
                  setSelectedLeagueNames(
                    [...selectedLeagueNames].filter(
                      (leagueKey) =>
                        !subGroup.leagues.some(
                          (league) =>
                            createLeagueIdentityKey(league.name, league.nation) === leagueKey
                        )
                    )
                  );
                  return;
                }
                setSelectedLeagueNames([
                  ...selectedLeagueNames,
                  ...subGroup.leagues.map((league) =>
                    createLeagueIdentityKey(league.name, league.nation)
                  )
                ]);
              }}
              ref={(element) => {
                if (element) {
                  element.indeterminate = !allSelected && someSelected;
                }
              }}
              title="Zaznacz wszystkie ligi w grupie"
              type="checkbox"
            />
            <button
              className="flex items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition hover:bg-surface"
              onClick={() => onToggleExpanded(subGroup.key)}
              type="button"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
              )}
              <span className="text-sm font-bold">{subGroup.displayName}</span>
              <span className="text-xs text-text-muted">{subGroup.leagues.length} lig</span>
            </button>
          </div>
          <div className="flex gap-1">
            {allHaveSameMatch ? (
              <button
                className="ldc-bulk-match-btn rounded-xl bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-accent-hover"
                data-group-id={subGroup.key}
                data-ldc-name={subGroup.leagues[0].suggestedMatch?.name}
                onClick={() => onAutoMatchGroup(subGroup)}
                title={`Dopasuj wszystkie znormalizowane/sugerowane (${subGroup.leagues.length})`}
                type="button"
              >
                Dopasuj automatycznie
              </button>
            ) : null}
            <button
              className="ldc-subgroup-select-btn rounded-xl border border-border px-2.5 py-1.5 text-[11px] font-semibold text-text-primary transition hover:bg-surface"
              onClick={() => onOpenGroupMatch(subGroup.leagues, subGroup.country)}
              title="Wybierz ligę dla wszystkich lig w grupie"
              type="button"
            >
              Wybierz ligę LDC
            </button>
            <button
              className="ldc-subgroup-add-btn rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-100"
              onClick={() => onOpenGroupAdd(subGroup, subGroup.country)}
              title="Dodaj wszystkie ligi z grupy"
              type="button"
            >
              Dodaj jako nowe
            </button>
          </div>
        </div>
      </div>
      {isExpanded ? (
        <div className="mt-2">
          {subGroup.leagues.map((league) => (
            <MissingLeagueRow
              key={createLeagueIdentityKey(league.name, league.nation)}
              isSelected={selectedLeagueNames.has(
                createLeagueIdentityKey(league.name, league.nation)
              )}
              league={league}
              onAdd={() => confirmAddLeague(league)}
              onAutoMatch={() => {
                if (!league.suggestedMatch) {
                  return;
                }
                addLeagueMapping(
                  { name: league.name, nation: league.nation },
                  {
                    name: league.suggestedMatch.name,
                    nation: league.suggestedMatch.nation ?? ''
                  }
                );
                checkMissingLeagues();
              }}
              onManualMatch={() => onOpenManualMatch(league)}
              onToggleSelection={() => onToggleSelection(league)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function LdcMissingPanelTrigger() {
  const hasCheckedMissingLeagues = useLdcMissingStore((state) => state.hasCheckedMissingLeagues);
  const isPanelVisible = useLdcMissingStore((state) => state.isPanelVisible);
  const isRechecking = useLdcMissingStore((state) => state.isRechecking);
  const hidePanel = useLdcMissingStore((state) => state.hidePanel);
  const missingLeagues = useLdcMissingStore((state) => state.missingLeagues);
  const showPanel = useLdcMissingStore((state) => state.showPanel);
  const missingCount = missingLeagues.length;
  const triggerLabel = getMissingPanelTriggerLabel(isRechecking, missingCount);

  return (
    <button
      className={cn(
        'rounded-xl border px-3 py-2 text-xs font-semibold transition',
        missingCount > 0
          ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
          : 'border-border text-text-primary hover:bg-surface'
      )}
      id="ldc-show-missing-btn"
      onClick={() => {
        if (!hasCheckedMissingLeagues) {
          checkMissingLeagues();
          showPanel();
          return;
        }

        if (isPanelVisible) {
          hidePanel();
          return;
        }

        showPanel();
      }}
      type="button"
    >
      {triggerLabel}
    </button>
  );
}

export function LdcMissingPanel() {
  const openBulkAddDialog = useLdcMissingStore((state) => state.openBulkAddDialog);
  const openMatchDialog = useLdcMissingStore((state) => state.openMatchDialog);
  const finishRecheck = useLdcMissingStore((state) => state.finishRecheck);
  const groups = useLdcMissingStore((state) => state.groups);
  const hasCheckedMissingLeagues = useLdcMissingStore((state) => state.hasCheckedMissingLeagues);
  const hidePanel = useLdcMissingStore((state) => state.hidePanel);
  const isPanelVisible = useLdcMissingStore((state) => state.isPanelVisible);
  const isRechecking = useLdcMissingStore((state) => state.isRechecking);
  const missingLeagues = useLdcMissingStore((state) => state.missingLeagues);
  const recheckSummary = useLdcMissingStore((state) => state.recheckSummary);
  const selectedLeagueNames = useLdcMissingStore((state) => state.selectedLeagueNames);
  const setSelectedLeagueNames = useLdcMissingStore((state) => state.setSelectedLeagueNames);
  const startRecheck = useLdcMissingStore((state) => state.startRecheck);
  const toggleLeagueSelection = useLdcMissingStore((state) => state.toggleLeagueSelection);
  const selectedLeagueSet = useMemo(() => new Set(selectedLeagueNames), [selectedLeagueNames]);
  const autoMatchedCount = useMemo(
    () => missingLeagues.filter((league) => league.suggestedMatch !== null).length,
    [missingLeagues]
  );
  const manualDecisionCount = missingLeagues.length - autoMatchedCount;
  const selectedLeagues = useMemo(
    () => getSelectedLeagues(groups, selectedLeagueNames),
    [groups, selectedLeagueNames]
  );
  const selectedCount = selectedLeagueNames.length;
  const {
    expandedCountryKeys,
    expandedSubGroupKeys,
    setExpandedCountryKeys,
    setExpandedSubGroupKeys
  } = useCleanExpandedKeys(groups);

  return (
    <div
      className={cn(
        'mb-4 rounded-xl border border-border bg-surface/35 p-3',
        hasCheckedMissingLeagues && isPanelVisible ? '' : 'hidden'
      )}
      id="ldc-missing-leagues"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-semibold text-text-primary">Brakujące ligi</label>
          <span
            className={cn('text-xs text-text-secondary', selectedCount > 0 ? '' : 'hidden')}
            id="ldc-selected-count"
          >
            {selectedCount} zaznaczonych
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={cn(PRIMARY_BUTTON_CLASS, selectedCount > 0 ? '' : 'hidden')}
            id="ldc-add-selected-btn"
            onClick={() => {
              if (selectedLeagues.length === 0) {
                showAlertModal('Brak zaznaczenia', 'Nie zaznaczono żadnych lig.');
                return;
              }
              selectedLeagues.forEach((league) => {
                addLeagueWithValues(
                  league.name,
                  league.nation || '',
                  league.suggestedStars || null,
                  league.suggestedRank || ldcSettings.leagues.length + 1
                );
              });
              checkMissingLeagues();
            }}
            title="Dodaj zaznaczone ligi"
            type="button"
          >
            Dodaj zaznaczone
          </button>
          <button
            className={cn(SECONDARY_BUTTON_CLASS, selectedCount > 0 ? '' : 'hidden')}
            id="ldc-match-selected-btn"
            onClick={() => {
              if (selectedLeagues.length === 0) {
                showAlertModal('Brak zaznaczenia', 'Nie zaznaczono żadnych lig.');
                return;
              }
              openMatchDialog(
                selectedLeagues,
                'Wybierz ligę z LDC dla zaznaczonych lig',
                'Zaznaczone ligi'
              );
            }}
            title="Dopasuj zaznaczone ligi"
            type="button"
          >
            Dopasuj zaznaczone
          </button>
          <button
            className={cn(PRIMARY_BUTTON_CLASS, missingLeagues.length > 0 ? '' : 'hidden')}
            id="ldc-add-missing-btn"
            onClick={() => {
              if (missingLeagues.length === 0) {
                showAlertModal('Brak brakujących lig', 'Brak brakujących lig do dodania.');
                return;
              }

              showConfirmModal(
                `Dodaj ${missingLeagues.length} sugerowanych lig`,
                'Czy chcesz dodać ligi z domyślnymi gwiazdkami i rankiem, czy dostosować ręcznie?',
                () => {
                  missingLeagues.forEach((league) => {
                    addLeagueWithValues(
                      league.name,
                      league.nation || '',
                      league.suggestedStars || null,
                      league.suggestedRank || ldcSettings.leagues.length + 1
                    );
                  });
                  checkMissingLeagues();
                },
                () =>
                  openBulkAddDialog(
                    missingLeagues,
                    `Dostosuj brakujące ligi (${missingLeagues.length})`,
                    ''
                  )
              );
            }}
            type="button"
          >
            Dodaj sugerowane
          </button>
          <button
            className={SECONDARY_BUTTON_CLASS}
            disabled={isRechecking}
            id="ldc-recheck-missing-btn"
            onClick={() => {
              const previousMissing = detectMissingLeagues();
              startRecheck();

              setTimeout(() => {
                checkMissingLeagues();
                const nextMissing = detectMissingLeagues();
                finishRecheck(buildMissingLeagueRecheckSummary(previousMissing, nextMissing));
                document
                  .querySelector<HTMLElement>('#ldc-missing-leagues')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }, 100);
            }}
            type="button"
          >
            {isRechecking ? 'Sprawdzanie...' : 'Ponownie sprawdź'}
          </button>
          <button
            className={SECONDARY_BUTTON_CLASS}
            id="ldc-hide-missing-btn"
            onClick={() => hidePanel()}
            type="button"
          >
            Ukryj
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <SummaryChip label={`${missingLeagues.length} lig`} />
        <SummaryChip label={`${groups.length} ${groups.length === 1 ? 'kraj' : 'kraje'}`} />
        <SummaryChip label={`${autoMatchedCount} z dopasowaniem`} />
        <SummaryChip label={`${manualDecisionCount} do decyzji`} />
      </div>

      <div
        aria-live="polite"
        className={cn(
          'text-xs',
          recheckSummary ? 'mb-3 min-h-[16px]' : 'mb-1 min-h-0',
          recheckSummary ? getToneClasses(recheckSummary.tone) : ''
        )}
        id="ldc-recheck-result"
      >
        {recheckSummary?.message ?? ''}
      </div>

      {missingLeagues.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background/70 px-4 py-8 text-center">
          <p className="text-sm font-medium text-text-primary">Nie wykryto brakujących lig</p>
          <p className="mt-1 text-xs text-text-muted">
            Wszystkie ligi z danych zawodników mają już odpowiadające wpisy lub mapowania w LDC.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-text-secondary">
            Następujące ligi występują w danych zawodników, ale nie mają jeszcze odpowiadających
            wpisów w LDC.
          </p>

          <div className="space-y-3 text-xs" id="ldc-missing-leagues-list">
            {groups.map((countryGroup, countryIndex) => (
              <CountryGroupSection
                countryGroup={countryGroup}
                countryIndex={countryIndex}
                expandedCountryKeys={expandedCountryKeys}
                expandedSubGroupKeys={expandedSubGroupKeys}
                key={countryGroup.key}
                onOpenBulkAddDialog={(leagues, title, country) =>
                  openBulkAddDialog(leagues, title, country)
                }
                onOpenMatchDialog={(leagues, title, country) =>
                  openMatchDialog(leagues, title, country)
                }
                onToggleCountryExpanded={(countryKey) =>
                  setExpandedCountryKeys((keys) =>
                    keys.includes(countryKey)
                      ? keys.filter((key) => key !== countryKey)
                      : [...keys, countryKey]
                  )
                }
                onToggleLeagueSelection={toggleLeagueSelection}
                onToggleSubGroupExpanded={(subGroupKey) =>
                  setExpandedSubGroupKeys((keys) =>
                    keys.includes(subGroupKey)
                      ? keys.filter((key) => key !== subGroupKey)
                      : [...keys, subGroupKey]
                  )
                }
                selectedLeagueNames={selectedLeagueSet}
                setSelectedLeagueNames={setSelectedLeagueNames}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
