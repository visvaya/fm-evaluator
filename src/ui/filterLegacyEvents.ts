// Delegated listeners for the legacy column-filter popup. They replace the inline
// on* attributes the markup used to carry, which the strict CSP (ADR-004,
// script-src-attr 'none') blocks. Column id and filter type come from the open
// request; per-control values are read from the DOM, never interpolated into code.

export interface LegacyFilterActions {
  applyFilter: (id: string, type: string) => void;
  filterCheckboxList: (id: string, text: string) => void;
  filterClubHasPossession: (id: string) => void;
  filterShowOnlyLDCMatched: (id: string) => void;
  persistUIState: () => void;
  setFilterArr: (id: string, value: string) => void;
  setPositionFilterMode: (mode: string) => void;
  updateFilterCounts: (id: string) => void;
}

export interface FilterPopupContext {
  actions: LegacyFilterActions;
  columnId: string;
  type: string;
}

type ChangeHandler = (input: HTMLInputElement, context: FilterPopupContext) => void;

const boundPopups = new WeakMap<HTMLElement, FilterPopupContext>();

const changeHandlers: Record<string, ChangeHandler> = {
  'club-possession': (_input, { actions, columnId }) => {
    actions.filterClubHasPossession(columnId);
    actions.updateFilterCounts(columnId);
  },
  'ldc-matched': (_input, { actions, columnId }) => {
    actions.filterShowOnlyLDCMatched(columnId);
    actions.updateFilterCounts(columnId);
  },
  'position-mode': (input, { actions }) => {
    actions.setPositionFilterMode(input.value);
    actions.persistUIState();
  },
  value: (input, { actions, columnId }) => {
    actions.setFilterArr(columnId, input.value);
    actions.updateFilterCounts(columnId);
  }
};

export function bindLegacyFilterPopup(popup: HTMLElement, context: FilterPopupContext): void {
  const alreadyBound = boundPopups.has(popup);
  boundPopups.set(popup, context);
  if (alreadyBound) return;

  popup.addEventListener('input', (event) => {
    const input = asInput(event.target);
    const current = boundPopups.get(popup);
    if (!input || !current || input.dataset.fmFilterInput !== 'search-list') return;
    current.actions.filterCheckboxList(current.columnId, input.value);
    current.actions.updateFilterCounts(current.columnId);
  });

  popup.addEventListener('change', (event) => {
    const input = asInput(event.target);
    const current = boundPopups.get(popup);
    if (!input || !current) return;
    const handler = changeHandlers[input.dataset.fmFilterChange ?? ''];
    if (handler) handler(input, current);
  });

  popup.addEventListener('keypress', (event) => {
    const input = asInput(event.target);
    const current = boundPopups.get(popup);
    if (event.key !== 'Enter' || !current || input?.dataset.fmEnterApply !== 'true') return;
    current.actions.applyFilter(current.columnId, current.type);
  });
}

function asInput(target: EventTarget | null): HTMLInputElement | null {
  return target instanceof HTMLInputElement ? target : null;
}
