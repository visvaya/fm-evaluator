import type { PlayerMetricBreakdownRow } from './modelTypes';

function formatPercentile(value: unknown): null | number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return Number(value.toFixed(1));
}

function getChartValue(value: unknown): null | number {
  if (value === null || value === undefined || value === '' || value === '-') {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function getRawValue(row: Record<string, unknown>): string {
  if (row.isMissing || row.missing) {
    return '–';
  }

  if (typeof row.val === 'number') {
    return row.val.toFixed(2);
  }

  const rawValue = row.rawValue ?? row.val ?? '–';
  return typeof rawValue === 'string' || typeof rawValue === 'number' ? String(rawValue) : '–';
}

function getWeightValue(weight: unknown): string {
  if (typeof weight === 'number') {
    return weight.toFixed(weight < 1 ? 4 : 2);
  }

  return typeof weight === 'string' || typeof weight === 'number' ? String(weight) : '–';
}

function getScoreValue(score: unknown): null | number {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return null;
  }

  return Number(score);
}

export function formatBreakdownRows(rows: any[] | undefined): PlayerMetricBreakdownRow[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) => ({
    chartValue: getChartValue(row.val),
    isLow: row.isLow,
    isMissing: row.isMissing || row.missing,
    isRange: row.isRange,
    label: row.name,
    percentile: formatPercentile(row.percentile),
    rawValue: getRawValue(row),
    score: getScoreValue(row.score),
    sourceKey: row.name,
    weight: getWeightValue(row.weight)
  }));
}
