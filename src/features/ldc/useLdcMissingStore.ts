import { create } from 'zustand';

import { createLeagueIdentityKey } from '@/computing/ldcMappings';

import type {
  MissingLeagueCandidate,
  MissingLeagueCountryGroup,
  MissingLeagueRecheckSummary
} from './missingLeaguesModel';

interface LdcMissingAddDialogPayload {
  league: MissingLeagueCandidate;
  mode: 'add';
}

interface LdcMissingBulkAddDialogPayload {
  country: string;
  leagues: MissingLeagueCandidate[];
  mode: 'bulk-add';
  title: string;
}

interface LdcMissingMatchDialogPayload {
  country: string;
  leagues: MissingLeagueCandidate[];
  mode: 'match';
  title: string;
}

type LdcMissingDialogState =
  | LdcMissingAddDialogPayload
  | LdcMissingBulkAddDialogPayload
  | LdcMissingMatchDialogPayload
  | null;

interface HydratePayload {
  groups: MissingLeagueCountryGroup[];
  missingLeagues: MissingLeagueCandidate[];
}

interface LdcMissingState {
  activeDialog: LdcMissingDialogState;
  clearSelection: () => void;
  closeDialog: () => void;
  finishRecheck: (summary: MissingLeagueRecheckSummary | null) => void;
  groups: MissingLeagueCountryGroup[];
  hasCheckedMissingLeagues: boolean;
  hidePanel: () => void;
  hydrateMissingLeagues: (payload: HydratePayload) => void;
  isPanelVisible: boolean;
  isRechecking: boolean;
  missingLeagues: MissingLeagueCandidate[];
  openAddDialog: (league: MissingLeagueCandidate) => void;
  openBulkAddDialog: (leagues: MissingLeagueCandidate[], title: string, country: string) => void;
  openMatchDialog: (leagues: MissingLeagueCandidate[], title: string, country: string) => void;
  recheckSummary: MissingLeagueRecheckSummary | null;
  selectedLeagueNames: string[];
  setSelectedLeagueNames: (selectedLeagueNames: string[]) => void;
  showPanel: () => void;
  startRecheck: () => void;
  toggleLeagueSelection: (league: MissingLeagueCandidate) => void;
}

function uniq(values: string[]) {
  return [...new Set(values)];
}

export const useLdcMissingStore = create<LdcMissingState>((set) => ({
  activeDialog: null,
  clearSelection: () => set({ selectedLeagueNames: [] }),
  closeDialog: () => set({ activeDialog: null }),
  finishRecheck: (recheckSummary) => set({ isRechecking: false, recheckSummary }),
  groups: [],
  hasCheckedMissingLeagues: false,
  hidePanel: () => set({ isPanelVisible: false, recheckSummary: null, selectedLeagueNames: [] }),
  hydrateMissingLeagues: ({ groups, missingLeagues }) =>
    set((state) => {
      const availableNames = new Set(
        missingLeagues.map((league) => createLeagueIdentityKey(league.name, league.nation))
      );
      return {
        groups,
        hasCheckedMissingLeagues: true,
        isPanelVisible: state.isPanelVisible,
        missingLeagues,
        recheckSummary: state.isRechecking ? state.recheckSummary : null,
        selectedLeagueNames: state.selectedLeagueNames.filter((name) => availableNames.has(name))
      };
    }),
  isPanelVisible: false,
  isRechecking: false,
  missingLeagues: [],
  openAddDialog: (league) =>
    set({
      activeDialog: {
        league,
        mode: 'add'
      }
    }),
  openBulkAddDialog: (leagues, title, country) =>
    set({
      activeDialog: {
        country,
        leagues,
        mode: 'bulk-add',
        title
      }
    }),
  openMatchDialog: (leagues, title, country) =>
    set({
      activeDialog: {
        country,
        leagues,
        mode: 'match',
        title
      }
    }),
  recheckSummary: null,
  selectedLeagueNames: [],
  setSelectedLeagueNames: (selectedLeagueNames) =>
    set({ selectedLeagueNames: uniq(selectedLeagueNames) }),
  showPanel: () => set({ isPanelVisible: true }),
  startRecheck: () => set({ isRechecking: true, recheckSummary: null }),
  toggleLeagueSelection: (league) =>
    set((state) => {
      const leagueKey = createLeagueIdentityKey(league.name, league.nation);
      return {
        selectedLeagueNames: state.selectedLeagueNames.includes(leagueKey)
          ? state.selectedLeagueNames.filter((name) => name !== leagueKey)
          : [...state.selectedLeagueNames, leagueKey]
      };
    })
}));
