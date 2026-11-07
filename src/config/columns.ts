// Phase 5B: Column definitions, virtual constants, collator, DOM cache
// Migrated from main.js L4628-4699

export interface ColumnDef {
  fullName?: string;
  hidden?: boolean;
  id: string;
  max?: number;
  min?: number;
  name: string;
  savedWidth?: number;
  step?: string;
  type: string;
  w?: string;
}

export let COLUMNS: ColumnDef[] = [
  { id: 'suggestion', name: 'Sugestia', type: 'checkbox' },
  { id: 'name', name: 'Nazwisko', type: 'search', w: '193px' },
  { id: 'club', name: 'Klub', type: 'complex', w: '141px' },
  { id: 'totalScore', name: 'Ocena', type: 'range' },
  { id: 'statScore', name: 'Stat', type: 'range' },
  { id: 'attrScore', name: 'Atr', type: 'range' },
  {
    fullName: 'Najlepsza rola według oceny ogólnej',
    hidden: true,
    id: 'bestRoleTotal',
    name: 'Role Best',
    type: 'range'
  },
  {
    fullName: 'Najlepsza rola według statystyk',
    hidden: true,
    id: 'bestRoleStat',
    name: 'Stat Best',
    type: 'range'
  },
  {
    fullName: 'Najlepsza rola według atrybutów',
    hidden: true,
    id: 'bestRoleAttr',
    name: 'Atr Best',
    type: 'range'
  },
  { id: 'dataCategory', name: 'Dane', type: 'checkbox' },
  { id: 'age', name: 'Wiek', type: 'range' },
  { id: 'mins', name: 'Minuty', type: 'range' },
  { id: 'league', name: 'Liga', type: 'complex', w: '134px' },
  { id: 'foot', name: 'Noga', type: 'checkbox' },
  {
    hidden: true,
    id: 'leftFootStars',
    max: 5,
    min: 0,
    name: 'Lewa noga',
    step: '1',
    type: 'range'
  },
  {
    hidden: true,
    id: 'rightFootStars',
    max: 5,
    min: 0,
    name: 'Prawa noga',
    step: '1',
    type: 'range'
  },
  { id: 'position', name: 'Pozycja', type: 'complex' },
  { id: 'value', name: 'Wartość', type: 'range' },
  { id: 'wage', name: 'Płaca', type: 'range' },
  { id: 'scorePerValue', name: 'xVal Ratio', step: '0.01', type: 'range' },
  { id: 'scorePerWage', name: 'xWage Ratio', step: '0.01', type: 'range' },
  { hidden: true, id: 'scorePerValueStat', name: 'xVal Ratio (Stat)', step: '0.01', type: 'range' },
  { hidden: true, id: 'scorePerWageStat', name: 'xWage Ratio (Stat)', step: '0.01', type: 'range' },
  { hidden: true, id: 'scorePerValueAtr', name: 'xVal Ratio (Atr)', step: '0.01', type: 'range' },
  { hidden: true, id: 'scorePerWageAtr', name: 'xWage Ratio (Atr)', step: '0.01', type: 'range' },
  {
    fullName: 'Średnie posiadanie piłki drużyny (liga)',
    hidden: true,
    id: 'Team Poss',
    name: 'Poss %',
    type: 'range',
    w: '70px'
  },
  {
    fullName: 'Possession-adjusted Tackles Attempted',
    id: 'PAdj Tck A',
    name: 'PAdj Tck',
    type: 'range'
  },
  {
    fullName: 'Possession-adjusted Interceptions',
    id: 'PAdj Int',
    name: 'PAdj Int',
    type: 'range'
  },
  { fullName: 'Possession-adjusted Clearances', id: 'PAdj Clr', name: 'PAdj Clr', type: 'range' },
  { fullName: 'Possession-adjusted Blocks', id: 'PAdj Blk', name: 'PAdj Blk', type: 'range' },
  {
    fullName: 'Possession-adjusted Pressures Attempted',
    id: 'PAdj Pres A',
    name: 'PAdj Pres A',
    type: 'range'
  }
];

export const DEFAULT_COLUMNS: ColumnDef[] = JSON.parse(JSON.stringify(COLUMNS));

export const VIRTUAL_ROW_HEIGHT = 46;
export const VIRTUAL_MIN_ROWS = Number.MAX_SAFE_INTEGER;
export const VIRTUAL_BATCH = 160;
export const VIRTUAL_BUFFER = 40;

export const collator = new Intl.Collator('pl', { numeric: true, sensitivity: 'base' });

export interface DOMElementsCache {
  centralZone: HTMLElement | null;
  colList: HTMLElement | null;
  colModal: HTMLElement | null;
  dropArea: HTMLElement | null;
  errorLog: HTMLElement | null;
  errorLogModal: HTMLElement | null;
  fileInput: HTMLInputElement | null;
  headerControls: HTMLElement | null;
  possessionClubInputWrapper: HTMLElement | null;
  possessionClubSearch: HTMLElement | null;
  possessionClubSelect: HTMLElement | null;
  possessionClubValue: HTMLElement | null;
  possessionError: HTMLElement | null;
  possessionModal: HTMLElement | null;
  possessionOcrText: HTMLElement | null;
  statusText: HTMLElement | null;
  statusTextModal: HTMLElement | null;
  step1: HTMLElement | null;
  step2: HTMLElement | null;
  tableBody: HTMLElement | null;
  tableHead: HTMLElement | null;
  tableScroller: HTMLElement | null;
  toggleRole: HTMLElement | null;
}

let _els: DOMElementsCache | null = null;

export function getEls(): DOMElementsCache {
  if (!_els) {
    _els = {
      centralZone: document.querySelector('#central-upload-zone'),
      colList: document.querySelector('#columns-list'),
      colModal: document.querySelector('#columns-modal'),
      dropArea: document.querySelector('#drop-area'),
      errorLog: document.querySelector('#error-log'),
      errorLogModal: document.querySelector('#error-log-modal'),
      fileInput: document.querySelector('#files-input'),
      headerControls: document.querySelector('#app-controls'),
      possessionClubInputWrapper: document.querySelector('#possession-club-input-wrapper'),
      possessionClubSearch: document.querySelector('#possession-club-search'),
      possessionClubSelect: document.querySelector('#possession-club-select'),
      possessionClubValue: document.querySelector('#possession-club-value'),
      possessionError: document.querySelector('#possession-modal-error'),
      possessionModal: document.querySelector('#possession-modal'),
      possessionOcrText: document.querySelector('#possession-ocr-text'),
      statusText: document.querySelector('#upload-status-text'),
      statusTextModal: document.querySelector('#upload-status-text-modal'),
      step1: document.querySelector('#step-1-upload'),
      step2: document.querySelector('#step-2-config'),
      tableBody: document.querySelector('#table-body'),
      tableHead: document.querySelector('#table-headers'),
      tableScroller: document.querySelector('#table-scroller'),
      toggleRole: document.querySelector('#toggle-role-filters')
    };
  }
  return _els;
}

export function resetColumns(): void {
  COLUMNS = JSON.parse(JSON.stringify(DEFAULT_COLUMNS));
}

/**
 * Safely add a new column if it doesn't exist yet. Unused today; kept until the React/TS
 * migration decides its fate.
 * @param col - Column definition to add
 * @public
 */
export function addDynamicColumn(col: ColumnDef): void {
  if (!COLUMNS.find((c) => c.id === col.id)) {
    // Attributes should be hidden by default to avoid cluttering the UI
    const isAttribute = col.id.startsWith('attribute_');
    const isStat = col.id.startsWith('statistic_');

    if (isAttribute || isStat) {
      col.hidden = true;
    }

    COLUMNS.push(col);
  }
}
