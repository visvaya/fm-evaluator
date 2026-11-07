/* eslint-disable @typescript-eslint/prefer-for-of, sonarjs/cognitive-complexity, sonarjs/no-duplicated-branches */
import { ALL_ROLES, ATTRIBUTE_COEFFS, NEGATIVE_STATS, STATS_CONFIG } from '../config/scoreConfig';

import { ensureRoleDistributions } from './roleDistributions';

export interface ScoreEntry {
  attrScore: number;
  role: string;
  statScore: number;
  totalScore: number;
}

interface CalculateScoresForAllRolesArgs {
  cleanValue: (value: unknown) => any;
  engine: string;
  mergedData: any[];
  statDistributionCache: Map<any, any>;
  threshold: null | number;
}

export function calculateScoresForAllRolesData({
  cleanValue,
  engine,
  mergedData,
  statDistributionCache,
  threshold
}: CalculateScoresForAllRolesArgs) {
  const allScoresMap = new Map<any, ScoreEntry[]>();

  for (let i = 0; i < mergedData.length; i++) {
    const p = mergedData[i];
    const uid = p.UID;
    const playerScores: ScoreEntry[] = [];

    for (const role of ALL_ROLES) {
      if (role === 'GK' && p.Position !== 'GK') {
        continue;
      }
      if (role !== 'GK' && p.Position === 'GK') {
        continue;
      }

      const keyStats = STATS_CONFIG[role] || [];
      const coeffs = ATTRIBUTE_COEFFS[engine][role] || {};

      let aSum = 0;
      let aW = 0;
      for (const [a, w] of Object.entries(coeffs)) {
        const rawV = p[a];
        const v = cleanValue(rawV) || 0;
        aSum += v * w;
        aW += Math.abs(w);
      }
      const aScore = aW > 0 ? aSum / aW : 0;

      const mins = cleanValue(p.Mins) || 0;
      const isLow = threshold !== null && mins < threshold;
      let sSum = 0;
      let sW = 0;

      if (!isLow && keyStats.length > 0) {
        const { statDist } = ensureRoleDistributions({
          cleanValue,
          keyStats,
          mergedData,
          role,
          statDistributionCache
        });

        keyStats.forEach((k, idx) => {
          let w = 1 + (keyStats.length - 1 - idx) / keyStats.length;
          if (role === 'GK' && k === 'xGP/90') {
            w = w * 1.2;
          }

          const v = cleanValue(p[k]);
          if (v !== null) {
            let raw;
            let sc;
            if (role === 'GK' && k === 'Pas %') {
              raw = (v - statDist[k].p50) / statDist[k].range;
              sc = Math.max(0, Math.min(20, 10 + raw * 5));
            } else if (k === 'OP-KP %') {
              raw = (v - statDist[k].p50) / statDist[k].range;
              sc = Math.max(0, Math.min(20, 10 + raw * 5));
            } else {
              raw = (v - statDist[k].median) / statDist[k].iqr;
              if ((NEGATIVE_STATS as readonly string[]).includes(k)) {
                raw = -raw;
              }
              sc = Math.max(0, Math.min(20, 10 + raw * 5));
            }
            sSum += sc * w;
            sW += w;
          }
        });
      }

      const sScore = sW > 0 ? sSum / sW : 0;

      let totalScore;
      if (aW > 0 && sW > 0) {
        totalScore = (aScore + sScore) / 2;
      } else if (aW > 0) {
        totalScore = aScore;
      } else if (sW > 0) {
        totalScore = sScore;
      } else {
        totalScore = 0;
      }

      playerScores.push({ attrScore: aScore, role, statScore: sScore, totalScore });
    }

    allScoresMap.set(uid, playerScores);
  }

  return allScoresMap;
}
