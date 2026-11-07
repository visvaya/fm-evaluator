import { createCleanValue } from '@/data/cleanValue';
import { getNumericValue } from '@/data/getNumericValue';
import { parseNumber } from '@/data/parseNumber';
import { type AppSettings } from '@/config/settingsModel';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTableStore } from '@/store/useTableStore';

const cleanValue = createCleanValue(new Map());

type LegacyProcessor = {
  calculatedScores?: any[];
  getTeamPossession?: (clubName: unknown) => null | number;
};

export interface FilterRuntime {
  calculatedScores: readonly any[];
  cleanValue: (value: unknown) => null | number | string;
  getMinMins: () => null | number;
  getNumericValue: (
    value: unknown,
    useAverageForRanges?: boolean,
    isWage?: boolean
  ) => null | number;
  getTeamPossession: (clubName: unknown) => null | number;
  parseNumber: (value: unknown) => null | number;
  settings: AppSettings;
}

function getLegacyProcessor(): LegacyProcessor | null {
  return (window as Window & { processor?: LegacyProcessor }).processor ?? null;
}

export function getFilterRuntime(): FilterRuntime {
  const legacyProcessor = getLegacyProcessor();
  const storeData = useTableStore.getState().data;

  return {
    calculatedScores: storeData.length > 0 ? storeData : (legacyProcessor?.calculatedScores ?? []),
    cleanValue,
    getMinMins: () => {
      const s = useSettingsStore.getState().settings;
      return s.minMins === null ? (s.adaptiveMinMins ?? null) : s.minMins;
    },
    getNumericValue,
    getTeamPossession: (clubName) => legacyProcessor?.getTeamPossession?.(clubName) ?? null,
    parseNumber,
    settings: useSettingsStore.getState().settings
  };
}
