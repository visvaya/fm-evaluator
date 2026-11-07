export interface AppSettings {
  adaptiveMinMins: null | number;
  defaultPossession: number;
  ldcFilterEnabled: boolean;
  ldcFilterMax: number;
  ldcFilterMin: number;
  maxBeeswarmPlayers: number;
  minMins: null | number;
  normalizeAttr: boolean;
  normalizeStat: boolean;
  normalizeTotal: boolean;
  pAdjEnabled: boolean;
  penaltyXGFactor: number;
  percentile: number;
}

export const defaultSettings: AppSettings = {
  adaptiveMinMins: null,
  defaultPossession: 50,
  ldcFilterEnabled: false,
  ldcFilterMax: 5,
  ldcFilterMin: 0,
  maxBeeswarmPlayers: 500,
  minMins: null,
  normalizeAttr: true,
  normalizeStat: true,
  normalizeTotal: false,
  pAdjEnabled: true,
  penaltyXGFactor: 0.76,
  percentile: 95
};

export interface RawSettingsInput {
  ldcFilterEnabled: boolean;
  ldcFilterMax: string;
  ldcFilterMin: string;
  maxBeeswarmPlayers: string;
  minMins: string;
  normalizeAttr: boolean;
  normalizeStat: boolean;
  normalizeTotal: boolean;
  pAdjEnabled: boolean;
  penaltyXGFactor: string;
  percentile: string;
}

export function parseSettingsInput(raw: RawSettingsInput): Partial<AppSettings> {
  return {
    ldcFilterEnabled: raw.ldcFilterEnabled,
    ldcFilterMax: parseFloat(raw.ldcFilterMax) || 5,
    ldcFilterMin: parseFloat(raw.ldcFilterMin) || 0,
    maxBeeswarmPlayers: parseFloat(raw.maxBeeswarmPlayers) || 500,
    minMins: raw.minMins === '' ? null : parseFloat(raw.minMins),
    normalizeAttr: raw.normalizeAttr,
    normalizeStat: raw.normalizeStat,
    normalizeTotal: raw.normalizeTotal,
    pAdjEnabled: raw.pAdjEnabled,
    penaltyXGFactor: parseFloat(raw.penaltyXGFactor),
    percentile: parseFloat(raw.percentile)
  };
}
