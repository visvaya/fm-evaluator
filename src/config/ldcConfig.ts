export interface LDCCacheData {
  matchedLeagues: null | Set<string>;
  matchedLeaguesHash: null | string;
  precision: {
    ldcRaw: null | number;
    leaguesHash: null | string;
    multiplier: null | number;
  };
}

/**
 * Minimal shape of a player row as seen by LDC lookup and stat application.
 * Stat columns are dynamic, hence the index signature.
 */
export interface LdcPlayerRow {
  [statKey: string]: unknown;
  'Based In'?: string;
  Club?: string;
  Division?: string;
  Nation?: string;
}

export type LDCModel = 'basket' | 'simple';
export type LdcSortColumn =
  | 'inputScore'
  | 'ldcRaw'
  | 'multiplier'
  | 'name'
  | 'nation'
  | 'rank'
  | 'stars';

/** View-only grouping of the league table; not persisted, like the league filter. */
export type LdcGroupBy = 'nation' | 'stars';

export interface LDCSettings {
  alphaBasket: number;
  alphaSimple: number;
  baseLeague: string;
  baseLeagueNation?: string;
  enabled: boolean;
  groupBy: LdcGroupBy | null;
  leagues: LeagueData[];
  model: LDCModel;
  sortColumn: LdcSortColumn;
  sortDirection: 'asc' | 'desc';
}

export interface LeagueData {
  id?: string;
  inputScore: number;
  ldcRaw: number;
  multiplier: number;
  name: string;
  nation: string;
  rank: number;
  stars: null | number;
}

export const DEFAULT_LDC_SETTINGS: LDCSettings = {
  alphaBasket: 1.7,
  alphaSimple: 5.3,
  baseLeague: 'Premier League',
  baseLeagueNation: 'Anglia',
  enabled: false,
  groupBy: null,
  leagues: [],
  model: 'basket',
  sortColumn: 'rank',
  sortDirection: 'asc'
};

// Mutable singleton for legacy bridge
export const ldcSettings: LDCSettings = { ...DEFAULT_LDC_SETTINGS };

// Singleton cache
export const ldcCache = new Map<string, number>();

export const ldcComputationCache: LDCCacheData = {
  matchedLeagues: null,
  matchedLeaguesHash: null,
  precision: {
    ldcRaw: null,
    leaguesHash: null,
    multiplier: null
  }
};

export interface BasketProblem {
  ldcRaw: number;
  leagues: LeagueData[];
  suggestions: string[];
}

export interface ClubLeague {
  country: string;
  league: string;
  multiplier: number;
}

export interface FuzzyMatchResult {
  league: LeagueData;
  score: number;
}

export interface LDCSnapshot {
  alphaBasket: number;
  alphaSimple: number;
  baseLeague: string;
  baseLeagueNation?: string;
  leagues: LeagueData[];
  mappings: LeagueMappings;
  model: LDCModel;
  sortColumn: LdcSortColumn;
  sortDirection: 'asc' | 'desc';
  timestamp: number;
}

export interface LdcMappingTarget {
  name: string;
  nation: string;
}

export type LdcLeagueReference = LdcMappingTarget;

export type LegacyLeagueMappings = Record<string, LdcMappingTarget | string>;
export type LeagueMappings = Record<string, LdcMappingTarget>;

export interface LeagueMatchResult {
  confidence: number;
  match: boolean;
  type: 'none' | 'normalized' | 'normalized_roman' | 'similarity';
}

export interface OrderProblem {
  league1: string;
  league1Index: number;
  league1Multiplier: number;
  league1Rank: number;
  league2: string;
  league2Index: number;
  league2Multiplier: number;
  league2Rank: number;
  suggestion: string;
}

export const ldcMappingState: {
  cache: LeagueMappings | null;
  initPromise: null | Promise<void>;
} = {
  cache: null,
  initPromise: null
};
