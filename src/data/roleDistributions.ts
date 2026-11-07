/* eslint-disable sonarjs/cognitive-complexity, sonarjs/no-duplicated-branches */
import { POSITION_FILTERS } from '../config/scoreConfig';

interface EnsureRoleDistributionsArgs {
  cleanValue: (value: unknown) => any;
  filterDistributionCache?: Map<any, any>;
  keyStats: string[];
  mergedData: any[];
  role: string;
  statDistributionCache: Map<any, any>;
}

export function ensureRoleDistributions({
  cleanValue,
  filterDistributionCache,
  keyStats,
  mergedData,
  role,
  statDistributionCache
}: EnsureRoleDistributionsArgs) {
  const filteredData =
    role === 'GK'
      ? mergedData.filter((player) => player.Position === 'GK')
      : mergedData.filter((player) => player.Position !== 'GK');

  let statDist = statDistributionCache.get(role);
  if (!statDist) {
    statDist = {};
    keyStats.forEach((key) => {
      const vals = [];
      for (const filteredDatum of filteredData) {
        const v = cleanValue(filteredDatum[key]);
        if (v !== null && !isNaN(v)) {
          vals.push(v);
        }
      }
      vals.sort((a, b) => a - b);

      if (vals.length < 2) {
        if (role === 'GK' && key === 'Pas %') {
          statDist[key] = { p10: 0, p50: 0, p90: 100, range: 100 };
        } else if (key === 'OP-KP %') {
          statDist[key] = { p10: 0, p50: 0, p90: 100, range: 100 };
        } else {
          statDist[key] = { iqr: 1, median: 0 };
        }
      } else if (role === 'GK' && key === 'Pas %') {
        const p10 = vals[Math.floor(vals.length * 0.1)] || vals[0];
        const p50 = vals[Math.floor(vals.length * 0.5)] || vals[0];
        const p90 = vals[Math.floor(vals.length * 0.9)] || vals.at(-1);
        const range = Math.max(0.01, p90 - p10);
        statDist[key] = { p10, p50, p90, range };
      } else if (key === 'OP-KP %') {
        const p10 = vals[Math.floor(vals.length * 0.1)] || vals[0];
        const p50 = vals[Math.floor(vals.length * 0.5)] || vals[0];
        const p90 = vals[Math.floor(vals.length * 0.9)] || vals.at(-1);
        const range = Math.max(0.01, p90 - p10);
        statDist[key] = { p10, p50, p90, range };
      } else {
        const q1 = vals[Math.floor(vals.length / 4)];
        const q3 = vals[Math.floor(vals.length * 0.75)];
        statDist[key] = {
          iqr: Math.max(0.01, q3 - q1),
          median: vals[Math.floor(vals.length / 2)]
        };
      }
    });
    statDistributionCache.set(role, statDist);
  }

  let filterDist = filterDistributionCache?.get(role) ?? null;
  if (filterDistributionCache && !filterDist) {
    filterDist = {};
    const filters = POSITION_FILTERS[role] || {};
    for (const [filterKey] of Object.entries(filters)) {
      const vals = [];
      for (const filteredDatum of filteredData) {
        const v = cleanValue(filteredDatum[filterKey]);
        if (v !== null && !isNaN(v)) {
          vals.push(v);
        }
      }
      vals.sort((a, b) => a - b);
      filterDist[filterKey] =
        vals.length > 0
          ? { max: vals.at(-1), min: vals[0], values: vals }
          : { max: 0, min: 0, values: [] };
    }
    filterDistributionCache.set(role, filterDist);
  }

  return { filteredData, filterDist, statDist };
}
