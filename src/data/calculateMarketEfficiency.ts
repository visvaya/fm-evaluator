import { getNumericValue } from './getNumericValue';

interface EfficiencyEntry {
  expected: null | number;
  ratio: null | number;
}

export function calculateMarketEfficiency(
  sortedPlayers: any[],
  valueKey: string,
  windowSize = 40,
  scoreKey = 'totalScore',
  filterFn: ((p: any) => boolean) | null = null
): Map<number, EfficiencyEntry> {
  const validData = sortedPlayers.filter((p) => {
    const val = getNumericValue(p[valueKey], true, valueKey === 'Wage');
    const score = p[scoreKey] || 0;
    const passesCustomFilter = filterFn ? filterFn(p) : true;
    return val !== null && val > 0 && score > 0 && passesCustomFilter;
  });

  const results = new Map<number, EfficiencyEntry>();

  validData.forEach((player, i) => {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(validData.length, start + windowSize);
    const neighbors = validData.slice(start, end);

    const neighborValues = neighbors
      .map((n: any) => getNumericValue(n[valueKey], true, valueKey === 'Wage'))
      .filter((v): v is number => v !== null && v > 0)
      .sort((a: number, b: number) => a - b);

    let medianVal = 0;
    if (neighborValues.length > 0) {
      const mid = Math.floor(neighborValues.length / 2);
      medianVal =
        neighborValues.length % 2 === 0
          ? (neighborValues[mid - 1] + neighborValues[mid]) / 2
          : neighborValues[mid];
    }

    const actualVal = Math.max(
      0,
      getNumericValue(player[valueKey], true, valueKey === 'Wage') || 0
    );
    const ratio = actualVal > 0 && medianVal > 0 ? medianVal / actualVal : null;

    results.set(player.tempIndex as number, {
      expected: medianVal > 0 ? medianVal : null,
      ratio
    });
  });

  return results;
}
