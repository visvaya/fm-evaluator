/* eslint-disable fp/no-mutation */

import { useVirtualizer } from '@tanstack/react-virtual';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { DEFAULT_LDC_SETTINGS, ldcSettings } from '@/config/ldcConfig';
import { calculateLDC } from '@/ui/ldcModal';
import { showAlertModal, showConfirmModal } from '@/ui/ldcModalHelpers';

import { buildLdcIssueGroups } from './ldcIssues';
import { LdcLeaguesBulkActions } from './LdcLeaguesBulkActions';
import { LdcLeaguesTable } from './LdcLeaguesTable';
import { LdcLeaguesToolbar } from './LdcLeaguesToolbar';
import { LdcProblemsPanel } from './LdcProblemsPanel';
import {
  alignRankToStars,
  alignStarsToRank,
  repairDuplicateLdcLeagues,
  repairOrderConflict,
  repairSingleTieringConflict,
  repairTieringConflicts
} from './ldcRepairs';
import { buildLdcLeagueRows } from './ldcTableModel';
import { useLdcStore } from './useLdcStore';

import type { LdcIssue } from './ldcIssues';

const VIRTUALIZATION_THRESHOLD = 120;
const ROW_ESTIMATE = 44;
const clientLeagueIdState = {
  next: 1
};
type LeagueEditableField = 'name' | 'nation' | 'rank' | 'stars';

function createClientLeagueId() {
  const nextId = `ldc-ui-${clientLeagueIdState.next}`;
  clientLeagueIdState.next += 1;
  return nextId;
}

function getLastLeagueStarsValue() {
  const lastLeague = ldcSettings.leagues.at(-1);
  if (lastLeague?.stars !== null && lastLeague?.stars !== undefined && lastLeague.stars >= 0.5) {
    return lastLeague.stars;
  }

  return 0.5;
}

function normalizeBasketStars(value: null | number) {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  return Math.max(0.5, Math.min(5, value));
}

function getCountryWarning(leagueId: string, rawValue: string) {
  const nextCountry = rawValue.trim().toLowerCase();
  if (nextCountry.length === 0) {
    return null;
  }

  const existingCountries = new Set(
    ldcSettings.leagues
      .filter((league) => league.id !== leagueId)
      .map((league) => league.nation.trim().toLowerCase())
      .filter((nation) => nation.length > 0)
  );

  return existingCountries.has(nextCountry)
    ? null
    : 'Ten kraj nie występował dotychczas na liście lig LDC';
}

function normalizeRanks() {
  ldcSettings.leagues.forEach((league, index) => {
    league.rank = index + 1;
  });
}

function commitLeagueMutation(mutator: () => void) {
  mutator();
  normalizeRanks();
  try {
    calculateLDC();
  } catch (error) {
    console.error('Failed to recalculate LDC after league mutation.', error);
  } finally {
    void useLdcStore.getState().syncFromLegacy();
  }
}

function applyLeagueListMutation(nextLeagues: typeof ldcSettings.leagues) {
  commitLeagueMutation(() => {
    ldcSettings.leagues = nextLeagues;
  });
}

function runAlignStarsToRankAction() {
  applyLeagueListMutation(alignStarsToRank(ldcSettings.leagues));
}

function runAlignRankToStarsAction() {
  applyLeagueListMutation(alignRankToStars(ldcSettings.leagues));
}

function runRepairTieringConflictsAction() {
  applyLeagueListMutation(repairTieringConflicts(ldcSettings.leagues));
}

function fixIssueAction(issue: LdcIssue) {
  if (issue.kind === 'consistency-conflict') {
    if (issue.orderProblem !== null) {
      applyLeagueListMutation(repairOrderConflict(ldcSettings.leagues, issue.affectedLeagueIds));
      return;
    }

    if (issue.tieringProblem !== null) {
      applyLeagueListMutation(
        repairSingleTieringConflict(ldcSettings.leagues, issue.tieringProblem)
      );
      return;
    }
  }

  if (issue.kind === 'duplicate-ldc') {
    applyLeagueListMutation(
      repairDuplicateLdcLeagues(ldcSettings.leagues, issue.affectedLeagueIds)
    );
    return;
  }

  if (issue.kind === 'order-conflict') {
    applyLeagueListMutation(repairOrderConflict(ldcSettings.leagues, issue.affectedLeagueIds));
    return;
  }

  if (issue.kind === 'tiering-conflict') {
    applyLeagueListMutation(repairSingleTieringConflict(ldcSettings.leagues, issue.problem));
  }
}

function getLeagueIndexById(leagueId: string) {
  return ldcSettings.leagues.findIndex((league) => league.id === leagueId);
}

function commitLeagueField(leagueId: string, field: LeagueEditableField, rawValue: string) {
  const leagueIndex = getLeagueIndexById(leagueId);
  if (leagueIndex === -1) {
    return;
  }

  const trimmedValue = rawValue.trim();

  if (field === 'rank') {
    const nextRank = Number.parseInt(trimmedValue, 10);
    if (Number.isNaN(nextRank) || nextRank < 1) {
      return;
    }

    commitLeagueMutation(() => {
      ldcSettings.leagues[leagueIndex].rank = nextRank;
      ldcSettings.leagues = ldcSettings.leagues.toSorted((left, right) => left.rank - right.rank);
    });
    return;
  }

  if (field === 'stars') {
    const nextStars = Number.parseFloat(trimmedValue);
    if (Number.isNaN(nextStars) || nextStars < 0.5 || nextStars > 5) {
      return;
    }

    commitLeagueMutation(() => {
      ldcSettings.leagues[leagueIndex].stars = normalizeBasketStars(nextStars);
    });
    return;
  }

  commitLeagueMutation(() => {
    if (field === 'name') {
      ldcSettings.leagues[leagueIndex].name = trimmedValue;
      return;
    }

    ldcSettings.leagues[leagueIndex].nation = trimmedValue;
  });
}

function moveLeagueById(leagueId: string, direction: 'down' | 'up') {
  commitLeagueMutation(() => {
    const currentIndex = getLeagueIndexById(leagueId);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ldcSettings.leagues.length) {
      return;
    }

    [ldcSettings.leagues[currentIndex], ldcSettings.leagues[targetIndex]] = [
      ldcSettings.leagues[targetIndex],
      ldcSettings.leagues[currentIndex]
    ];
  });
}

function moveSelectedLeagues(direction: 'down' | 'up', selectedLeagueIds: string[]) {
  const selectedIndices = ldcSettings.leagues
    .map((league, index) => ({ index, selected: selectedLeagueIds.includes(league.id ?? '') }))
    .filter((entry) => entry.selected)
    .map((entry) => entry.index)
    .toSorted((left, right) => (direction === 'up' ? left - right : right - left));

  selectedIndices.forEach((index) => {
    const offset = direction === 'up' ? -1 : 1;
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= ldcSettings.leagues.length) {
      return;
    }

    [ldcSettings.leagues[index], ldcSettings.leagues[targetIndex]] = [
      ldcSettings.leagues[targetIndex],
      ldcSettings.leagues[index]
    ];
  });
}

export function LdcLeaguesSection() {
  const {
    basketProblems,
    clearSelectedLeagueIds,
    isLeaguesExpanded,
    leagueFilter,
    orderProblems,
    searchTerm,
    selectedLeagueIds,
    setLeagueFilter,
    setLeaguesExpanded,
    setSearchTerm,
    setSelectedLeagueIds,
    setSortColumn,
    settings,
    toggleSelectedLeagueId
  } = useLdcStore();
  const [countryWarnings, setCountryWarnings] = useState<Record<string, string>>({});
  const [highlightedLeagueIds, setHighlightedLeagueIds] = useState<string[]>([]);
  const [pendingFocusLeagueId, setPendingFocusLeagueId] = useState<null | string>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const showLdcRaw =
    settings.baseLeague !== DEFAULT_LDC_SETTINGS.baseLeague ||
    (settings.baseLeagueNation ?? '') !== (DEFAULT_LDC_SETTINGS.baseLeagueNation ?? '');
  const rows = useMemo(
    () => buildLdcLeagueRows(settings, deferredSearchTerm, leagueFilter, showLdcRaw),
    [deferredSearchTerm, leagueFilter, settings, showLdcRaw]
  );
  const visibleLeagueIds = rows.map((row) => row.rowId);
  const allSelected =
    visibleLeagueIds.length > 0 &&
    visibleLeagueIds.every((leagueId) => selectedLeagueIds.includes(leagueId));
  const selectedCount = selectedLeagueIds.length;
  const shouldVirtualize = isLeaguesExpanded && rows.length >= VIRTUALIZATION_THRESHOLD;
  const columnCount = showLdcRaw ? 9 : 8;
  const issueGroups = useMemo(
    () => buildLdcIssueGroups(settings, basketProblems, orderProblems),
    [basketProblems, orderProblems, settings]
  );
  const virtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => ROW_ESTIMATE,
    getScrollElement: () => tableScrollRef.current,
    overscan: 10
  });
  const virtualItems = shouldVirtualize ? virtualizer.getVirtualItems() : [];
  const paddingTop =
    shouldVirtualize && virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom =
    shouldVirtualize && virtualItems.length > 0
      ? Math.max(0, virtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0))
      : 0;

  useEffect(() => {
    if (!isLeaguesExpanded || pendingFocusLeagueId === null) {
      return;
    }

    const rowIndex = rows.findIndex((row) => row.rowId === pendingFocusLeagueId);
    if (rowIndex === -1) {
      return;
    }

    if (shouldVirtualize) {
      virtualizer.scrollToIndex(rowIndex, { align: 'center' });
    }

    let attempts = 0;
    const timers = new Set<number>();
    const tryFocusRow = () => {
      const selector = `input[data-row-id="${pendingFocusLeagueId}"][data-field="name"]`;
      const input = tableScrollRef.current?.querySelector<HTMLInputElement>(selector);
      if (!input) {
        if (attempts >= 8) {
          return;
        }

        attempts += 1;
        const retryTimer = window.setTimeout(tryFocusRow, shouldVirtualize ? 48 : 24);
        timers.add(retryTimer);
        return;
      }

      input.focus();
      input.select();
      input.scrollIntoView({ block: 'center', inline: 'nearest' });
      setPendingFocusLeagueId(null);
    };

    const focusTimer = window.setTimeout(tryFocusRow, shouldVirtualize ? 48 : 0);
    timers.add(focusTimer);

    return () => {
      timers.forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, [isLeaguesExpanded, pendingFocusLeagueId, rows, shouldVirtualize, virtualizer]);

  const handleCommitField = (
    leagueId: string,
    field: 'name' | 'nation' | 'rank' | 'stars',
    rawValue: string
  ) => {
    if (field === 'nation') {
      setCountryWarnings((current) => {
        const warning = getCountryWarning(leagueId, rawValue);
        if (warning === null) {
          if (!(leagueId in current)) {
            return current;
          }

          const nextWarnings = { ...current };
          delete nextWarnings[leagueId];
          return nextWarnings;
        }

        return {
          ...current,
          [leagueId]: warning
        };
      });
    }

    commitLeagueField(leagueId, field, rawValue);
  };

  const handleCountryInputChange = (leagueId: string, rawValue: string) => {
    setCountryWarnings((current) => {
      const warning = getCountryWarning(leagueId, rawValue);
      if (warning === null) {
        if (!(leagueId in current)) {
          return current;
        }

        const nextWarnings = { ...current };
        delete nextWarnings[leagueId];
        return nextWarnings;
      }

      return {
        ...current,
        [leagueId]: warning
      };
    });
  };

  const deleteLeague = (leagueId: string, leagueName: string) => {
    const removeLeague = () => {
      ldcSettings.leagues = ldcSettings.leagues.filter((league) => league.id !== leagueId);
    };
    const clearLeagueCountryWarning = () => {
      setCountryWarnings((current) => {
        const nextWarnings = { ...current };
        delete nextWarnings[leagueId];
        return nextWarnings;
      });
    };
    const clearDeletedLeagueSelection = () => {
      setSelectedLeagueIds(
        selectedLeagueIds.filter((selectedLeagueId) => selectedLeagueId !== leagueId)
      );
    };

    showConfirmModal(
      `Usuń ligę "${leagueName}"`,
      'Ta operacja usunie ligę z konfiguracji LDC.',
      () => {
        commitLeagueMutation(removeLeague);
        clearLeagueCountryWarning();
        clearDeletedLeagueSelection();
      }
    );
  };

  const addLeague = () => {
    const existingNames = new Set(ldcSettings.leagues.map((league) => league.name));
    const baseName = 'Nowa liga';
    const name = existingNames.has(baseName)
      ? (Array.from(
          { length: existingNames.size + 1 },
          (_, index) => `${baseName} ${index + 1}`
        ).find((candidate) => !existingNames.has(candidate)) ??
        `${baseName} ${existingNames.size + 1}`)
      : baseName;
    const nextLeagueId = createClientLeagueId();

    setSearchTerm('');
    setLeagueFilter('all');
    setLeaguesExpanded(true);
    setPendingFocusLeagueId(nextLeagueId);

    commitLeagueMutation(() => {
      ldcSettings.sortColumn = 'rank';
      ldcSettings.sortDirection = 'asc';
      ldcSettings.leagues = [
        ...ldcSettings.leagues,
        {
          id: nextLeagueId,
          inputScore: 0,
          ldcRaw: 0,
          multiplier: 1,
          name,
          nation: '',
          rank: ldcSettings.leagues.length + 1,
          stars: settings.model === 'basket' ? getLastLeagueStarsValue() : null
        }
      ];
    });
  };

  const focusIssue = (issue: LdcIssue) => {
    setSearchTerm('');
    setLeagueFilter('all');
    setLeaguesExpanded(true);
    setHighlightedLeagueIds(issue.affectedLeagueIds);
    setSelectedLeagueIds(issue.affectedLeagueIds);
    setPendingFocusLeagueId(issue.affectedLeagueIds[0] ?? null);
  };

  const bulkDelete = () => {
    if (selectedLeagueIds.length === 0) {
      showAlertModal('Brak zaznaczenia', 'Nie zaznaczono żadnych lig.');
      return;
    }

    const deleteSelectedLeagues = () => {
      const selected = new Set(selectedLeagueIds);
      ldcSettings.leagues = ldcSettings.leagues.filter((league) => !selected.has(league.id ?? ''));
    };

    showConfirmModal(
      `Usuń ${selectedLeagueIds.length} lig`,
      'Ta operacja usunie wszystkie zaznaczone ligi z konfiguracji LDC.',
      () => {
        commitLeagueMutation(deleteSelectedLeagues);
        clearSelectedLeagueIds();
      }
    );
  };

  const bulkChangeStars = () => {
    if (selectedLeagueIds.length === 0) {
      showAlertModal('Brak zaznaczenia', 'Nie zaznaczono żadnych lig.');
      return;
    }

    const response = window.prompt(
      `Podaj nową wartość gwiazdek dla ${selectedLeagueIds.length} lig:`,
      ''
    );
    if (response === null) {
      return;
    }

    const starsValue = Number.parseFloat(response);
    if (Number.isNaN(starsValue) || starsValue < 0.5 || starsValue > 5) {
      showAlertModal('Nieprawidłowa wartość', 'Nieprawidłowa wartość gwiazdek (0.5-5).');
      return;
    }

    commitLeagueMutation(() => {
      const selected = new Set(selectedLeagueIds);
      ldcSettings.leagues = ldcSettings.leagues.map((league) =>
        selected.has(league.id ?? '')
          ? {
              ...league,
              stars: normalizeBasketStars(starsValue)
            }
          : league
      );
    });
  };

  const bulkChangeRank = () => {
    if (selectedLeagueIds.length === 0) {
      showAlertModal('Brak zaznaczenia', 'Nie zaznaczono żadnych lig.');
      return;
    }

    const response = window.prompt(`Podaj nowy rank dla ${selectedLeagueIds.length} lig:`, '');
    if (response === null) {
      return;
    }

    const rankValue = Number.parseInt(response, 10);
    if (Number.isNaN(rankValue) || rankValue < 1) {
      showAlertModal('Nieprawidłowa wartość', 'Nieprawidłowa wartość ranku (minimum 1).');
      return;
    }

    commitLeagueMutation(() => {
      const selected = new Set(selectedLeagueIds);
      ldcSettings.leagues = ldcSettings.leagues
        .map((league) =>
          selected.has(league.id ?? '')
            ? {
                ...league,
                rank: rankValue
              }
            : league
        )
        .toSorted((left, right) => left.rank - right.rank);
    });
  };

  const bulkMove = (direction: 'down' | 'up') => {
    if (selectedLeagueIds.length === 0) {
      showAlertModal('Brak zaznaczenia', 'Nie zaznaczono żadnych lig.');
      return;
    }

    commitLeagueMutation(() => {
      moveSelectedLeagues(direction, selectedLeagueIds);
    });
  };

  return (
    <>
      <LdcProblemsPanel
        issueGroups={issueGroups}
        onAlignRankToStars={runAlignRankToStarsAction}
        onAlignStarsToRank={runAlignStarsToRankAction}
        onFixIssue={fixIssueAction}
        onFocusIssue={focusIssue}
        onRepairTieringConflicts={runRepairTieringConflictsAction}
      />

      <div className="overflow-hidden rounded-xl border border-border bg-surface/35">
        <LdcLeaguesToolbar
          isExpanded={isLeaguesExpanded}
          leagueFilter={leagueFilter}
          onAddLeague={addLeague}
          onLeagueFilterChange={setLeagueFilter}
          onSearchTermChange={setSearchTerm}
          onToggleExpanded={() => {
            setLeaguesExpanded(!isLeaguesExpanded);
          }}
          searchTerm={searchTerm}
        />
        {isLeaguesExpanded ? (
          <div className="border-t border-border">
            <LdcLeaguesBulkActions
              onBulkChangeRank={bulkChangeRank}
              onBulkChangeStars={bulkChangeStars}
              onBulkDelete={bulkDelete}
              onBulkMoveDown={() => {
                bulkMove('down');
              }}
              onBulkMoveUp={() => {
                bulkMove('up');
              }}
              selectedCount={selectedCount}
            />
            <LdcLeaguesTable
              allSelected={allSelected}
              columnCount={columnCount}
              countryWarnings={countryWarnings}
              highlightedLeagueIds={highlightedLeagueIds}
              onCommitField={handleCommitField}
              onCountryInputChange={handleCountryInputChange}
              onDeleteLeague={deleteLeague}
              onMoveLeagueDown={(leagueId) => moveLeagueById(leagueId, 'down')}
              onMoveLeagueUp={(leagueId) => moveLeagueById(leagueId, 'up')}
              onSelectAllChange={() => {
                if (allSelected) {
                  setSelectedLeagueIds(
                    selectedLeagueIds.filter((leagueId) => !visibleLeagueIds.includes(leagueId))
                  );
                  return;
                }

                setSelectedLeagueIds([...selectedLeagueIds, ...visibleLeagueIds]);
              }}
              onSortColumn={setSortColumn}
              paddingBottom={paddingBottom}
              paddingTop={paddingTop}
              rows={rows}
              selectedLeagueIds={selectedLeagueIds}
              settingsBaseLeague={settings.baseLeague}
              shouldVirtualize={shouldVirtualize}
              showLdcRaw={showLdcRaw}
              sortColumn={settings.sortColumn}
              sortDirection={settings.sortDirection}
              tableScrollRef={tableScrollRef}
              toggleSelectedLeagueId={toggleSelectedLeagueId}
              virtualRows={virtualItems.map((item) => rows[item.index])}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
