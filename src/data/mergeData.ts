/* eslint-disable @typescript-eslint/prefer-for-of, no-restricted-globals, sonarjs/cognitive-complexity, sonarjs/max-lines-per-function */

import { getFeetStars } from '@/utils/helpers';

import { readImportedCellText } from './importedCellText';

interface FileMeta {
  html?: string;
  parsedData?: any[];
  type?: string;
}

interface MergeDataDependencies {
  attributes: any[];
  cleanValue: (value: any) => any;
  defaultPossession?: number;
  fileStack: FileMeta[];
  parseFeet: (player: any) => { left: number; right: number };
  parsePositions: (position: string) => any;
  stats: any[];
}

// The production cleanValue (src/data/cleanValue.ts) returns the original
// string for text it cannot parse (e.g. "Premier League"), not null - so
// `value !== null && !Number.isNaN(value)` is true for arbitrary strings too
// (Number.isNaN only ever returns true for the literal NaN value). Every
// numeric check below must go through this instead.
function toFiniteNumber(value: unknown): null | number {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// A row "has" a key meaningfully only if cleanValue doesn't consider it a
// missing-data placeholder - cleanValue.ts's MISSING_SYMBOLS set treats '-',
// 'N/A', 'Unknown', 'Nieznana' etc. as absent, not just '' - so a plain
// trim()-based emptiness check would still let those placeholders shadow a
// real value arriving in a later file.
function hasMeaningfulValue(row: any, key: string, cleanValue: (value: any) => any): boolean {
  if (!(key in row)) {
    return false;
  }
  return cleanValue(row[key]) !== null;
}

export function mergeProcessorData(
  { attributes, cleanValue, fileStack, parseFeet, parsePositions, stats }: MergeDataDependencies,
  mergeMode = false
): any[] {
  if (mergeMode) {
    const attrGroups = new Map<string, any[]>();
    const statGroups = new Map<string, any[]>();

    for (let i = 0; i < attributes.length; i += 1) {
      const attr = attributes[i];
      if (attr.UID) {
        if (!attrGroups.has(attr.UID)) {
          attrGroups.set(attr.UID, []);
        }
        attrGroups.get(attr.UID).push(attr);
      }
    }

    for (let i = 0; i < stats.length; i += 1) {
      const stat = stats[i];
      if (stat.UID) {
        if (!statGroups.has(stat.UID)) {
          statGroups.set(stat.UID, []);
        }
        statGroups.get(stat.UID).push(stat);
      }
    }

    const allUIDs = new Set([...attrGroups.keys(), ...statGroups.keys()]);
    const mergedData = [];
    // Field names below must match the canonical/legacy names the parser
    // actually writes onto player rows (src/schema/schemaRegistry.js's
    // getLegacyHeaderName map), NOT guessed abbreviations - a mismatch here
    // means the sum/rate is silently never recomputed in merge mode.
    // 'Ast' (not 'As'), 'Pas A' (not 'Ps A'), 'Hdrs' (not 'Hdrs W'),
    // 'Clear' (not 'Clr') were previously wrong and always skipped.
    const sumStats = [
      'Mins',
      'Gls',
      'Ast',
      'Shots',
      'xG',
      'xA',
      'Pens',
      'Pens S',
      'Fls',
      'FA',
      'CCC',
      'Distance',
      'Pr Passes',
      'OP-KP',
      'OP-Crs C',
      'OP-Crs A',
      'Tck A',
      'Tck C',
      'Hdrs',
      'Hdrs A',
      'Pres A',
      'Pres C',
      'Itc',
      'Blk',
      'Clear',
      'Pas A',
      'Ps C'
    ];
    const sumStatsSet = new Set(sumStats);
    // 'Poss Won/90', 'Poss Lost/90' and 'Shts In/90' have no raw (non-per-90)
    // source field in the schema at all - FM exports/derives them directly
    // as per-90 rates - so they cannot be recomputed from a summed total.
    // They fall through to the generic minutes-weighted average below instead.
    const per90FromSum: Record<string, string> = {
      'CCC/90': 'CCC',
      'Dist/90': 'Distance',
      'Gls/90': 'Gls',
      'OP-KP/90': 'OP-KP',
      'Pres A/90': 'Pres A',
      'Pr Passes/90': 'Pr Passes',
      'Shots/90': 'Shots',
      'xA/90': 'xA',
      'xG/90': 'xG'
    };
    const pctFromParts: [string, string, string][] = [
      ['Pas %', 'Ps C', 'Pas A'],
      ['Hdr %', 'Hdrs', 'Hdrs A'],
      ['Tck R', 'Tck C', 'Tck A'],
      // OP-KP % = OP-KP / Pas A (see deriveStats.ts), not OP-Crs A.
      ['OP-KP %', 'OP-KP', 'Pas A'],
      ['OP-Crs C %', 'OP-Crs C', 'OP-Crs A'],
      ['Pres C %', 'Pres C', 'Pres A']
    ];
    const pctKeySet = new Set(pctFromParts.map(([key]) => key));
    const derivedLater = new Set([
      'CCC %',
      'Conv %',
      'Net Fouls/90',
      'NP-Gls-NP-xG/90',
      'NP-xG/90',
      'Poss+/-/90',
      'Shts Out/90'
    ]);

    for (const uid of allUIDs) {
      const attrList = attrGroups.get(uid) || [];
      const statList = statGroups.get(uid) || [];
      const merged = { UID: uid } as any;

      if (attrList.length > 0) {
        // Union of keys across ALL attribute rows for this UID, not just
        // the first row - a column that only shows up in a later attribute
        // file (e.g. Division/Based In coming from a different export than
        // the one with Name/Position) must not be silently dropped, since
        // LDC falls back to a neutral 1.000 multiplier when it's missing.
        const allAttrKeys = new Set<string>(attrList.flatMap((row) => Object.keys(row)));
        for (const key of allAttrKeys) {
          if (key === 'UID') {
            continue;
          }
          // Prefer the first row with a genuinely non-empty value for this
          // key - a row that merely has the key present but blank (e.g.
          // Division: '') must not shadow a real value in a later row.
          const rowWithMeaningfulValue = attrList.find((row) =>
            hasMeaningfulValue(row, key, cleanValue)
          );
          const rowWithKey = rowWithMeaningfulValue ?? attrList.find((row) => key in row);
          if (rowWithKey) {
            merged[key] = rowWithKey[key];
          }
        }
      }

      if (statList.length > 0) {
        const firstStat = statList[0];
        const totalMins = statList.reduce(
          (sum, row) => sum + (toFiniteNumber(cleanValue(row.Mins)) ?? 0),
          0
        );
        // Union of keys across ALL stat rows for this UID - a column that
        // only appears starting from the second file must still be summed
        // / averaged, not skipped because row 0 didn't have it.
        const allStatKeys = new Set<string>(statList.flatMap((row) => Object.keys(row)));

        for (const key of sumStats) {
          if (!allStatKeys.has(key)) {
            continue;
          }
          const values = statList
            .map((row) => toFiniteNumber(cleanValue(row[key])))
            .filter((value): value is number => value !== null);
          merged[key] =
            values.length > 0 ? values.reduce((left, right) => left + right, 0) : firstStat[key];
        }

        for (const [statKey, rawKey] of Object.entries(per90FromSum)) {
          if (!allStatKeys.has(statKey)) {
            continue;
          }
          const rawSum = toFiniteNumber(cleanValue(merged[rawKey]));
          if (rawSum !== null && totalMins > 0) {
            merged[statKey] = ((rawSum / totalMins) * 90).toFixed(2);
          }
        }

        for (const [statKey, numeratorKey, denominatorKey] of pctFromParts) {
          if (!allStatKeys.has(statKey)) {
            continue;
          }
          const numerator = toFiniteNumber(cleanValue(merged[numeratorKey])) ?? 0;
          const denominator = toFiniteNumber(cleanValue(merged[denominatorKey])) ?? 0;
          if (denominator > 0) {
            merged[statKey] = ((numerator / denominator) * 100).toFixed(1);
          }
        }

        for (const key of allStatKeys) {
          if (key === 'UID') {
            continue;
          }
          if (
            sumStatsSet.has(key) ||
            key in per90FromSum ||
            pctKeySet.has(key) ||
            derivedLater.has(key)
          ) {
            continue;
          }
          if (key in merged) {
            continue;
          }

          // Only rows that actually carry this key contribute to the
          // weighted average - a row missing the stat must not drag the
          // result toward zero by still counting its Mins in the shared
          // denominator (totalMins is deliberately NOT used here).
          const rowsWithKey = statList.filter((row) => key in row);

          // Whether this key is numeric is decided across ALL rows, not
          // just the first one - a blank/text first row (common when a
          // stat is only reported starting from a later file) must not
          // misclassify an otherwise-numeric column as text.
          let weightedSum = 0;
          let keyMins = 0;
          let hasNumericValue = false;
          for (const row of rowsWithKey) {
            const value = toFiniteNumber(cleanValue(row[key]));
            if (value === null) {
              continue;
            }
            hasNumericValue = true;
            const mins = toFiniteNumber(cleanValue(row.Mins)) ?? 0;
            weightedSum += value * mins;
            keyMins += mins;
          }

          if (hasNumericValue) {
            if (keyMins > 0) {
              merged[key] = (weightedSum / keyMins).toFixed(2);
            } else {
              const firstNumericRow = rowsWithKey.find(
                (row) => toFiniteNumber(cleanValue(row[key])) !== null
              );
              merged[key] = firstNumericRow?.[key];
            }
          } else {
            const firstMeaningfulRow = rowsWithKey.find((row) =>
              hasMeaningfulValue(row, key, cleanValue)
            );
            merged[key] = (firstMeaningfulRow ?? rowsWithKey.at(-1))?.[key];
          }
        }
      }

      if (merged['Transfer Value'] || merged['Wartość'] || merged.basic_transfer_value) {
        merged.basic_transfer_value_display =
          merged['Transfer Value'] || merged['Wartość'] || merged.basic_transfer_value_display;
      }
      if (merged.Wage || merged['Płaca'] || merged.basic_wage) {
        merged.basic_wage_display = merged.Wage || merged['Płaca'] || merged.basic_wage_display;
      }

      merged.positionArray = parsePositions(merged.Position || '');
      merged.pos2Array = parsePositions(merged['Sec. Position'] || '');
      const { left, right } = parseFeet(merged);
      merged.leftFootStars = getFeetStars(left);
      merged.rightFootStars = getFeetStars(right);
      merged.leftFootValue = left;
      merged.rightFootValue = right;
      mergedData.push(merged);
    }

    return mergedData;
  }

  const attrMap = new Map();
  const statMap = new Map();

  for (let i = 0; i < fileStack.length; i += 1) {
    const fileMeta = fileStack[i];

    if (fileMeta.parsedData && fileMeta.parsedData.length > 0) {
      for (const row of fileMeta.parsedData) {
        if (!row.UID) {
          continue;
        }
        if (fileMeta.type === 'attr' || fileMeta.type === 'both' || fileMeta.type === 'complete') {
          attrMap.set(row.UID, row);
        }
        if (fileMeta.type === 'stats' || fileMeta.type === 'both' || fileMeta.type === 'complete') {
          statMap.set(row.UID, row);
        }
      }
      continue;
    }

    const fileHtml = fileMeta.html;
    if (!fileHtml) {
      continue;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(fileHtml, 'text/html');
    const table = doc.querySelector('table');
    if (!table) {
      continue;
    }

    const headers = [...table.querySelectorAll('th')].map((th) => th.textContent?.trim() ?? '');
    const rows = [...table.querySelectorAll('tr')].slice(1);

    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      const parsedRow = {} as Record<string, string>;
      for (const [index, header] of headers.entries()) {
        if (cells[index]) {
          parsedRow[header] = readImportedCellText(cells[index]);
        }
      }

      if (!parsedRow.UID) {
        continue;
      }
      if (fileMeta.type === 'attr' || fileMeta.type === 'both' || fileMeta.type === 'complete') {
        attrMap.set(parsedRow.UID, parsedRow);
      }
      if (fileMeta.type === 'stats' || fileMeta.type === 'both' || fileMeta.type === 'complete') {
        statMap.set(parsedRow.UID, parsedRow);
      }
    }
  }

  if (fileStack.length === 0) {
    for (let i = 0; i < attributes.length; i += 1) {
      if (attributes[i].UID) {
        attrMap.set(attributes[i].UID, attributes[i]);
      }
    }
    for (let i = 0; i < stats.length; i += 1) {
      if (stats[i].UID) {
        statMap.set(stats[i].UID, stats[i]);
      }
    }
  }

  const allUIDs = new Set([...attrMap.keys(), ...statMap.keys()]);
  const mergedData = [];
  for (const uid of allUIDs) {
    const attr = attrMap.get(uid) || {};
    const stat = statMap.get(uid) || {};
    const merged = { ...stat, ...attr, UID: uid };
    merged.positionArray = parsePositions(merged.Position || '');
    merged.pos2Array = parsePositions(merged['Sec. Position'] || '');
    const { left, right } = parseFeet(merged);
    merged.leftFootStars = getFeetStars(left);
    merged.rightFootStars = getFeetStars(right);
    merged.leftFootValue = left;
    merged.rightFootValue = right;
    mergedData.push(merged);
  }

  return mergedData;
}
