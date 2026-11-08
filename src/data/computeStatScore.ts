/* eslint-disable sonarjs/cognitive-complexity, sonarjs/max-lines-per-function */
import {
  NEGATIVE_STATS,
  PER90_TO_SOURCE,
  PERCENTAGE_TO_SOURCE,
  SKIPPABLE_STATS,
  ZERO_SKIPPABLE_STATS
} from '../config/scoreConfig';

import { parseNumber } from './parseNumber';
import { splitRange } from './splitRange';

type CleanValue = (val: unknown, isWage?: boolean) => any;

export interface StatDetail {
  isLow?: boolean;
  isRange: boolean;
  missing: boolean;
  name: string;
  rawValue: unknown;
  score: null | number;
  skipped: boolean;
  val: string;
  weight: number;
}

export interface StatDistribution {
  iqr: number;
  median: number;
  p50: number;
  range: number;
}

export interface StatScoreResult {
  missingStatCount: number;
  rangeStatCount: number;
  sD: StatDetail[];
  sScore: number;
  totalStatWeight: number;
}

function isEmpty(rawV: unknown): boolean {
  return rawV === null || rawV === undefined || rawV === '' || rawV === '-';
}

function numOf(rawV: unknown, cleanValue: CleanValue): number {
  return isEmpty(rawV) ? 0 : (cleanValue(rawV) as number) || 0;
}

function detectSourceZero(k: string, player: Record<string, any>, cleanValue: CleanValue): boolean {
  switch (k) {
    case 'Aer A/90':
    case 'Hdr %':
    case 'Hdrs A/90':
    case 'Hdrs L/90':
    case 'Hdrs W/90': {
      const hdrsA = player['Hdrs A'];
      return isEmpty(hdrsA) || (cleanValue(hdrsA) || 0) === 0;
    }
    case 'Asts/90': {
      const xA90 = player['xA/90'];
      const xA90Val = isEmpty(xA90) ? null : (cleanValue(xA90) as number) || 0;
      if (xA90Val === null) return numOf(player.xA, cleanValue) === 0;
      return xA90Val === 0;
    }
    case 'Blk/90': {
      const blk = player.Blk;
      return isEmpty(blk) || (cleanValue(blk) || 0) === 0;
    }
    case 'CCC': {
      const chC90 = player['Ch C/90'];
      return isEmpty(chC90) || (cleanValue(chC90) || 0) === 0;
    }
    case 'Ch C/90': {
      const chC = player['Ch C'];
      return isEmpty(chC) || (cleanValue(chC) || 0) === 0;
    }
    case 'Cln/90':
    case 'Con/90': {
      const concVal = numOf(player.Conc, cleanValue);
      const totalSaves =
        numOf(player.Svh, cleanValue) +
        numOf(player.Svt, cleanValue) +
        numOf(player.Svp, cleanValue);
      const pensFacedVal = numOf(player['Pens Faced'], cleanValue);
      return (
        concVal === 0 &&
        player.xGP === null &&
        totalSaves === 0 &&
        (isEmpty(player['Pens Faced']) || pensFacedVal === 0)
      );
    }
    case 'Clr/90': {
      const clear = player.Clr;
      return isEmpty(clear) || (cleanValue(clear) || 0) === 0;
    }
    case 'Conv %':
    case 'FK Shots':
    case 'Shot/90':
    case 'Shots Outside Box/90':
    case 'ShT':
    case 'ShT/90':
    case 'Shts In/90':
    case 'Shts Out/90': {
      const shots = player.Shots;
      return isEmpty(shots) || (cleanValue(shots) || 0) === 0;
    }
    case 'Cr C':
    case 'Cr C/90':
    case 'Cr C/A':
    case 'Crs A/90': {
      const crA = player['Cr A'];
      return isEmpty(crA) || (cleanValue(crA) || 0) === 0;
    }
    case 'Gls/90': {
      const shots90 = player['Shots/90'];
      const shots90Val = isEmpty(shots90) ? null : (cleanValue(shots90) as number) || 0;
      if (shots90Val === null) return numOf(player.Shots, cleanValue) === 0;
      return shots90Val === 0;
    }
    case 'Goals Outside Box': {
      return numOf(player.Gls, cleanValue) === 0;
    }
    case 'Hdrs': {
      return numOf(player['Hdrs A'], cleanValue) === 0;
    }
    case 'K Hdrs/90': {
      const hdrsA = player['Hdrs A'];
      return isEmpty(hdrsA) || (cleanValue(hdrsA) || 0) === 0;
    }
    case 'K Pas':
    case 'K Ps/90':
    case 'OP-KP':
    case 'OP-KP/90': {
      const pasAVal = numOf(player['Pas A'], cleanValue);
      const kPasVal = numOf(player['K Pas'], cleanValue);
      const kPasIsEmpty = isEmpty(player['K Pas']);
      return pasAVal === 0 && (kPasVal === 0 || kPasIsEmpty);
    }
    case 'K Tck':
    case 'K Tck/90':
    case 'Tck/90':
    case 'Tck C':
    case 'Tck Qual':
    case 'Tck R': {
      const tckA = player['Tck A'];
      return isEmpty(tckA) || (cleanValue(tckA) || 0) === 0;
    }
    case 'Mins/Gl': {
      return numOf(player.Gls, cleanValue) === 0;
    }
    case 'NP-xG/90': {
      const xGVal = numOf(player.xG, cleanValue);
      const pensVal = numOf(player.Pens, cleanValue);
      const xGIsEmpty = isEmpty(player.xG);
      const pensIsEmpty = isEmpty(player.Pens);
      return (xGIsEmpty && pensIsEmpty) || (xGVal === 0 && pensVal === 0);
    }
    case 'OP-Cr %':
    case 'OP-Crs A/90':
    case 'OP-Crs C':
    case 'OP-Crs C %':
    case 'OP-Crs C/90': {
      const opCrsA = player['OP-Crs A'];
      return isEmpty(opCrsA) || (cleanValue(opCrsA) || 0) === 0;
    }
    case 'Pen/R':
    case 'Pens S': {
      return numOf(player.Pens, cleanValue) === 0;
    }
    case 'Pens Saved':
    case 'Pens Saved Ratio': {
      const pensFaced = player['Pens Faced'];
      return isEmpty(pensFaced) || (cleanValue(pensFaced) || 0) === 0;
    }
    case 'Poss Lost/90':
    case 'Poss Won/90': {
      return (
        numOf(player['Poss Won/90'], cleanValue) + numOf(player['Poss Lost/90'], cleanValue) === 0
      );
    }
    case 'Pres A/90':
    case 'Pres C %':
    case 'Pres C/90': {
      const pasA = player['Pas A'];
      return isEmpty(pasA) || (cleanValue(pasA) || 0) === 0;
    }
    case 'Save Efficiency':
    case 'Saves/90':
    case 'Sv %':
    case 'Svh/90':
    case 'Svp/90':
    case 'Svt/90': {
      const totalSaves =
        numOf(player.Svh, cleanValue) +
        numOf(player.Svt, cleanValue) +
        numOf(player.Svp, cleanValue);
      return totalSaves === 0;
    }
    case 'Shts Blckd': {
      return numOf(player['Shts Blckd'], cleanValue) === 0 && numOf(player.Shots, cleanValue) === 0;
    }
    case 'Shts Blckd/90': {
      const shtsBlckd = player['Shts Blckd'];
      return isEmpty(shtsBlckd) || (cleanValue(shtsBlckd) || 0) === 0;
    }
    case 'Tck C/90':
    case 'Tck Failed/90': {
      const tckA = player['Tck A'];
      return isEmpty(tckA) || (cleanValue(tckA) || 0) === 0;
    }
    case 'xA/90': {
      let kPas = player['K Pas'];
      if (isEmpty(kPas)) kPas = player['Key Passes'];
      return numOf(kPas, cleanValue) === 0;
    }
    case 'xG-OP': {
      const xGZero = numOf(player.xG, cleanValue) === 0;
      const shots90 = player['Shots/90'];
      const shots90Val = isEmpty(shots90) ? null : (cleanValue(shots90) as number) || 0;
      const shots90Zero = shots90Val !== null && shots90Val === 0;
      return xGZero || shots90Zero || numOf(player.Shots, cleanValue) === 0;
    }
    default: {
      if (PER90_TO_SOURCE[k]) {
        const sourceKey = PER90_TO_SOURCE[k];
        if (sourceKey in player) {
          const sourceRaw = player[sourceKey];
          if (!isEmpty(sourceRaw)) {
            const sourceVal = cleanValue(sourceRaw) as null | number;
            return sourceVal !== null && Math.abs(sourceVal) < 0.001;
          }
          return true;
        }
      }
      if (PERCENTAGE_TO_SOURCE[k]) {
        const sourceKey = PERCENTAGE_TO_SOURCE[k];
        if (sourceKey in player) {
          const sourceRaw = player[sourceKey];
          if (!isEmpty(sourceRaw)) {
            const sourceVal = cleanValue(sourceRaw) as null | number;
            return sourceVal !== null && Math.abs(sourceVal) < 0.001;
          }
          return true;
        }
      }
      return false;
    }
  }
}

function detectStatRange(rawV: unknown): boolean {
  if (rawV === null || rawV === undefined) return false;
  const s = String(rawV).trim();
  if (!/\d/.test(s)) return false;
  if (s.startsWith('-') || s.startsWith('–') || s.startsWith('\u2014')) return false;
  if (!s.includes('-') && !s.includes('–') && !s.includes('\u2014')) return false;
  const m = splitRange(s);
  if (!m) return false;
  return parseNumber(m[0]) !== null && parseNumber(m[1]) !== null;
}

export function computeStatScore(
  player: Record<string, any>,
  keyStats: string[],
  config: { isLow: boolean; position: string; statDist: Record<string, StatDistribution> },
  cleanValue: CleanValue
): StatScoreResult {
  const { isLow, position, statDist } = config;
  const sD: StatDetail[] = [];
  let sSum = 0;
  let sW = 0;
  let missingStatCount = 0;
  let rangeStatCount = 0;

  keyStats.forEach((k, i) => {
    let w = 1 + (keyStats.length - 1 - i) / keyStats.length;
    if (position === 'GK' && k === 'xGP/90') w *= 1.2;

    const rawV = player[k];
    let v = cleanValue(rawV) as null | number;
    const isSkippable = (SKIPPABLE_STATS as readonly string[]).includes(k);
    const isZeroSkippable = (ZERO_SKIPPABLE_STATS as readonly string[]).includes(k);
    const fieldEmpty = isEmpty(rawV);

    let isRawZero = false;
    if (!fieldEmpty) {
      const rawNum = cleanValue(rawV) as null | number;
      isRawZero = rawNum !== null && Math.abs(rawNum) < 0.001;
    }

    const isSourceZero = isZeroSkippable ? detectSourceZero(k, player, cleanValue) : false;

    let xGP90ShouldSkip = false;
    if (k === 'xGP/90' && isSkippable) {
      const totalSaves =
        numOf(player.Svh, cleanValue) +
        numOf(player.Svt, cleanValue) +
        numOf(player.Svp, cleanValue);
      xGP90ShouldSkip = totalSaves === 0;
    }

    let npGlsNpxG90ShouldSkip = false;
    if (k === 'NP-Gls-NP-xG/90' && isSkippable && v !== null && Math.abs(v) < 0.001) {
      const glsIsEmpty = isEmpty(player.Gls);
      const xGIsEmpty = isEmpty(player.xG);
      npGlsNpxG90ShouldSkip =
        (glsIsEmpty && xGIsEmpty) ||
        (numOf(player.Gls, cleanValue) === 0 && numOf(player.xG, cleanValue) === 0);
    }

    const isSkipped =
      (isSkippable && ((v === null && fieldEmpty) || xGP90ShouldSkip || npGlsNpxG90ShouldSkip)) ||
      (isZeroSkippable &&
        (rawV === '-' || (v !== null && Math.abs(v) < 0.001) || isRawZero || isSourceZero));

    const isRange = !fieldEmpty && !isSkipped && detectStatRange(rawV);
    if (isRange) rangeStatCount++;

    if (isLow) {
      sD.push({
        isLow: true,
        isRange,
        missing: fieldEmpty,
        name: k,
        rawValue: rawV,
        score: null,
        skipped: isSkipped,
        val: fieldEmpty || isSkipped ? '-' : v === null ? '-' : v.toFixed(2),
        weight: w
      });
      missingStatCount++;
    } else if (isSkipped) {
      sSum += 0;
      sW += w;
      sD.push({
        isRange: false,
        missing: true,
        name: k,
        rawValue: rawV,
        score: 0,
        skipped: true,
        val: '-',
        weight: w
      });
      missingStatCount++;
    } else {
      if (v === null) {
        v = 0;
        missingStatCount++;
      }
      const dist = statDist[k] ?? { iqr: 1, median: 0, p50: 0, range: 1 };
      let raw: number;
      if ((position === 'GK' && k === 'Pas %') || k === 'OP-KP %') {
        raw = (v - dist.p50) / dist.range;
      } else {
        raw = (v - dist.median) / dist.iqr;
        if ((NEGATIVE_STATS as readonly string[]).includes(k)) raw = -raw;
      }
      const sc = Math.max(0, Math.min(20, 10 + raw * 5));
      sSum += sc * w;
      sW += w;
      sD.push({
        isRange,
        missing: player[k] === null,
        name: k,
        rawValue: rawV,
        score: sc,
        skipped: false,
        val: v === 0 && player[k] === null ? '-' : v.toFixed(2),
        weight: w
      });
    }
  });

  return {
    missingStatCount,
    rangeStatCount,
    sD,
    sScore: sW > 0 ? sSum / sW : 0,
    totalStatWeight: sW
  };
}
