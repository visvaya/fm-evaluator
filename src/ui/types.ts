// Type definitions for UI state and components
// This file defines the shared state interfaces used by the UI modules

export interface Column {
  fullName?: string;
  id: string;
  name: string;
  savedWidth?: number;
  type?: string;
  w?: string;
}

export interface DOMElements {
  errorLog: HTMLElement;
  fileInput: HTMLInputElement;
  statusText: HTMLElement;
  tableBody: HTMLElement;
  tableHead: HTMLElement;
  tableScroller: HTMLElement;
}

export interface FilterValue {
  max?: number;
  min?: number;
  value?: number | string;
  values?: (number | string)[];
}

export interface Player {
  [key: string]: any;
  age?: number | string;
  attrDetails?: Record<string, any>[];
  bestRole?: {
    attrRole?: string;
    role?: string;
    statRole?: string;
    totalRole?: string;
  };
  bestRoleAttr?: null | {
    role: string;
    score: number;
  };
  bestRoleStat?: null | {
    role: string;
    score: number;
  };
  bestRoleTotal?: null | {
    role: string;
    score: number;
  };
  club?: string;
  dataCategory?: string;
  filters?: {
    limit: string;
    name: string;
    passed: boolean;
    skipped?: boolean;
    val: string;
  }[];
  foot?: string;
  hasAnyRange?: boolean;
  isLow?: boolean;
  league?: string;
  leftFootStars?: string;
  leftFootValue?: null | number;
  mins?: number | string;
  name: string;
  pos2Array?: string[];
  position?: string;
  positionArray?: string[];
  rightFootStars?: string;
  rightFootValue?: null | number;
  scorePerValue?: null | number;
  scorePerValueAtr?: null | number;
  scorePerValueStat?: null | number;
  scorePerWage?: null | number;
  scorePerWageAtr?: null | number;
  scorePerWageStat?: null | number;
  shouldItalicizeAttrScore?: boolean;
  shouldItalicizeStatScore?: boolean;
  statDetails?: Record<string, any>[];
  statScore: number;
  suggestion?: string;
  totalScore: number;
  uid: string;
  value?: number | string;
  valueRating?: null | string;
  wage?: number | string;
  wageRating?: null | string;
}

export interface SortState {
  col: string;
  dir: 'asc' | 'desc';
}

export interface UIState {
  activeFilters: Record<string, FilterValue>;
  currentPage: number;
  currentSort: SortState;
  filterDirty: boolean;
  headersDirty: boolean;
  hiddenColumns: string[];
  pinnedColumns: string[];
  rowsPerPage: number;
}

export interface VirtualState {
  enabled: boolean;
  end: number;
  start: number;
  total: number;
}
