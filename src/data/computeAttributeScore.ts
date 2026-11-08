import { parseNumber } from './parseNumber';
import { splitRange } from './splitRange';

type CleanValue = (val: unknown, isWage?: boolean) => any;

export interface AttributeDetail {
  isMissing: boolean;
  isRange: boolean;
  name: string;
  rawValue: unknown;
  score: number;
  val: number;
  weight: number;
}

export interface AttributeScoreResult {
  aD: AttributeDetail[];
  aScore: number;
  missingAttrCount: number;
  rangeAttrCount: number;
  totalAttrWeight: number;
}

function detectRange(rawV: unknown): boolean {
  if (rawV === null || rawV === undefined) return false;
  const s = String(rawV).trim();
  if (!/\d/.test(s)) return false;
  if (s.startsWith('-') || s.startsWith('–') || s.startsWith('\u2014')) return false;
  if (!s.includes('-') && !s.includes('–') && !s.includes('\u2014')) return false;
  const m = splitRange(s);
  if (!m) return false;
  return parseNumber(m[0]) !== null && parseNumber(m[1]) !== null;
}

export function computeAttributeScore(
  player: Record<string, any>,
  coeffs: Record<string, number>,
  cleanValue: CleanValue
): AttributeScoreResult {
  const aD: AttributeDetail[] = [];
  let aSum = 0;
  let aW = 0;
  let missingAttrCount = 0;
  let rangeAttrCount = 0;

  for (const [a, w] of Object.entries(coeffs)) {
    const rawV = player[a];
    const v = (cleanValue(rawV) as number) || 0;
    const isMissing = rawV === undefined || rawV === null || rawV === '' || rawV === '-';
    const isRange = !isMissing && detectRange(rawV);

    if (isMissing) missingAttrCount++;
    else if (isRange) rangeAttrCount++;

    aSum += v * w;
    aW += Math.abs(w);
    aD.push({ isMissing, isRange, name: a, rawValue: rawV, score: v * w, val: v, weight: w });
  }

  return {
    aD,
    aScore: aW > 0 ? aSum / aW : 0,
    missingAttrCount,
    rangeAttrCount,
    totalAttrWeight: aW
  };
}
