import { createCleanValue } from '@/data/cleanValue';
import { getPlayerRuntimeRows } from '@/lib/playerRuntimeCache';

const cleanValue = createCleanValue(new Map());

export function calculatePercentile(value: number, sortedValues: number[]): null | number {
  if (
    !sortedValues ||
    sortedValues.length === 0 ||
    value === null ||
    value === undefined ||
    Number.isNaN(value)
  ) {
    return null;
  }

  const count = sortedValues.filter((sortedValue) => sortedValue <= value).length;
  return (count / sortedValues.length) * 100;
}

export function getStatPercentile(
  statName: string,
  playerValue: number,
  position: string,
  isAttribute = false
): null | number {
  if (playerValue === null || playerValue === undefined || Number.isNaN(playerValue)) {
    return null;
  }

  const playerRows = getPlayerRuntimeRows();

  const contextData = isAttribute
    ? playerRows
    : playerRows.filter((candidate: Record<string, unknown>) =>
        position === 'GK' ? candidate.Position === 'GK' : candidate.Position !== 'GK'
      );

  const values = contextData
    .map((candidate: Record<string, unknown>) => cleanValue(candidate[statName]))
    .filter((value: null | number): value is number => value !== null && !Number.isNaN(value))
    .toSorted((a: number, b: number) => a - b);

  return calculatePercentile(playerValue, values);
}
