import type { ScoreEntry } from './calculateScoresForAllRoles';

const SCORE_EPSILON = 0.001;
const DEFAULT_ROLE = 'DC';

export interface BestRoleDetails {
  attrRole: string;
  attrScore: number;
  role: string;
  statRole: string;
  statScore: number;
  totalRole: string;
  totalScore: number;
}

interface NormalizeRoleScoresMapArgs {
  normalizeAttr: boolean;
  normalizeStat: boolean;
  normalizeTotal: boolean;
  roleScoresMap: Map<any, ScoreEntry[]>;
}

interface GlobalScoreEntry extends ScoreEntry {
  uid: any;
}

interface ScoreBounds {
  attr: { max: number; min: number };
  stat: { max: number; min: number };
  total: { max: number; min: number };
}

interface BoundSelector {
  key: keyof ScoreBounds;
  select: (score: GlobalScoreEntry) => number;
}

function sortRoleNames(roles: string[]) {
  return roles.toSorted((left, right) => left.localeCompare(right)).join('/');
}

function collectTiedRoles(scores: ScoreEntry[], scoreKey: keyof ScoreEntry) {
  let bestScore = scores[0];

  for (const score of scores) {
    if ((score[scoreKey] as number) > (bestScore[scoreKey] as number)) {
      bestScore = score;
    }
  }

  return {
    roleNames: sortRoleNames(
      scores
        .filter(
          (score) =>
            Math.abs((score[scoreKey] as number) - (bestScore[scoreKey] as number)) < SCORE_EPSILON
        )
        .map((score) => score.role)
    ),
    score: bestScore[scoreKey] as number
  };
}

function collectGlobalScoreEntries(roleScoresMap: Map<any, ScoreEntry[]>) {
  const allScoresArray: GlobalScoreEntry[] = [];

  for (const [uid, scores] of roleScoresMap.entries()) {
    for (const score of scores) {
      allScoresArray.push({
        attrScore: score.attrScore,
        role: score.role,
        statScore: score.statScore,
        totalScore: score.totalScore,
        uid
      });
    }
  }

  return allScoresArray;
}

function collectScoreBounds({
  allScoresArray,
  normalizeAttr,
  normalizeStat,
  normalizeTotal
}: {
  allScoresArray: GlobalScoreEntry[];
  normalizeAttr: boolean;
  normalizeStat: boolean;
  normalizeTotal: boolean;
}) {
  const bounds: ScoreBounds = {
    attr: { max: -Infinity, min: Infinity },
    stat: { max: -Infinity, min: Infinity },
    total: { max: -Infinity, min: Infinity }
  };
  const selectors: BoundSelector[] = [
    normalizeTotal ? { key: 'total', select: (score) => score.totalScore } : null,
    normalizeStat ? { key: 'stat', select: (score) => score.statScore } : null,
    normalizeAttr ? { key: 'attr', select: (score) => score.attrScore } : null
  ].filter((selector): selector is BoundSelector => selector !== null);

  for (const score of allScoresArray) {
    for (const selector of selectors) {
      const value = selector.select(score);
      bounds[selector.key] = {
        max: Math.max(bounds[selector.key].max, value),
        min: Math.min(bounds[selector.key].min, value)
      };
    }
  }

  return bounds;
}

function normalizeValue(value: number, min: number, max: number) {
  if (max > min) {
    return ((value - min) / (max - min)) * 20;
  }

  if (max === min) {
    return max > 0 ? 20 : 0;
  }

  return value;
}

function combineNormalizedScores(attrScore: number, statScore: number) {
  return (attrScore + statScore) / 2;
}

function applyNormalizedScores({
  bounds,
  normalizeAttr,
  normalizeStat,
  normalizeTotal,
  roleScoresMap,
  score
}: {
  bounds: ScoreBounds;
  normalizeAttr: boolean;
  normalizeStat: boolean;
  normalizeTotal: boolean;
  roleScoresMap: Map<any, ScoreEntry[]>;
  score: GlobalScoreEntry;
}) {
  const nextAttrScore = normalizeAttr
    ? normalizeValue(score.attrScore, bounds.attr.min, bounds.attr.max)
    : score.attrScore;
  const nextStatScore = normalizeStat
    ? normalizeValue(score.statScore, bounds.stat.min, bounds.stat.max)
    : score.statScore;
  let nextTotalScore = score.totalScore;

  if (normalizeTotal) {
    nextTotalScore = normalizeValue(score.totalScore, bounds.total.min, bounds.total.max);
  } else if (normalizeStat || normalizeAttr) {
    nextTotalScore = combineNormalizedScores(nextAttrScore, nextStatScore);
  }

  const playerScores = roleScoresMap.get(score.uid);
  if (!playerScores) {
    return;
  }

  const roleScore = playerScores.find((playerScore) => playerScore.role === score.role);
  if (roleScore) {
    roleScore.totalScore = nextTotalScore;
    roleScore.statScore = nextStatScore;
    roleScore.attrScore = nextAttrScore;
  }
}

export function normalizeRoleScoresMap({
  normalizeAttr,
  normalizeStat,
  normalizeTotal,
  roleScoresMap
}: NormalizeRoleScoresMapArgs) {
  if (!normalizeAttr && !normalizeStat && !normalizeTotal) {
    return roleScoresMap;
  }

  // Group by role so each role is normalized independently – the best player
  // in each role reaches 20.0 rather than being penalized by a different role's max.
  const scoresByRole = new Map<string, GlobalScoreEntry[]>();
  for (const entry of collectGlobalScoreEntries(roleScoresMap)) {
    scoresByRole.set(entry.role, [...(scoresByRole.get(entry.role) ?? []), entry]);
  }

  for (const roleScores of scoresByRole.values()) {
    const bounds = collectScoreBounds({
      allScoresArray: roleScores,
      normalizeAttr,
      normalizeStat,
      normalizeTotal
    });
    for (const score of roleScores) {
      applyNormalizedScores({
        bounds,
        normalizeAttr,
        normalizeStat,
        normalizeTotal,
        roleScoresMap,
        score
      });
    }
  }

  return roleScoresMap;
}

export function buildPlayerBestRoleDetails(roleScoresMap: Map<any, ScoreEntry[]>) {
  const playerBestRoles = new Map<any, BestRoleDetails>();

  for (const [uid, scores] of roleScoresMap.entries()) {
    if (scores.length === 0) {
      continue;
    }

    const bestTotal = collectTiedRoles(scores, 'totalScore');
    const bestStat = collectTiedRoles(scores, 'statScore');
    const bestAttr = collectTiedRoles(scores, 'attrScore');

    playerBestRoles.set(uid, {
      attrRole: bestAttr.roleNames,
      attrScore: bestAttr.score,
      role: bestTotal.roleNames,
      statRole: bestStat.roleNames,
      statScore: bestStat.score,
      totalRole: bestTotal.roleNames,
      totalScore: bestTotal.score
    });
  }

  return playerBestRoles;
}

export function inferMostCommonPrimaryRole(playerBestRoles: Map<any, BestRoleDetails>) {
  const roleCounts = new Map<string, number>();
  let mostCommonRole = DEFAULT_ROLE;
  let maxCount = 0;

  for (const bestRole of playerBestRoles.values()) {
    const primaryRole = bestRole.role.split('/')[0];
    const nextCount = (roleCounts.get(primaryRole) || 0) + 1;
    roleCounts.set(primaryRole, nextCount);

    if (nextCount > maxCount) {
      maxCount = nextCount;
      mostCommonRole = primaryRole;
    }
  }

  return mostCommonRole;
}
