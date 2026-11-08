import { resolveMappingTargetLeague } from '@/computing/ldcMappings';
import { buildLeagueNameIndex, formatLdcRaw, validateLeague } from '@/computing/ldcUtils';

import type { BasketProblem, LDCSettings, LeagueData, OrderProblem } from '@/config/ldcConfig';

export type LdcIssueKind =
  | 'configuration'
  | 'consistency-conflict'
  | 'duplicate-ldc'
  | 'order-conflict'
  | 'tiering-conflict';

export interface TieringProblem {
  higherLeagueId: string;
  higherLeagueName: string;
  higherLeagueRank: number;
  higherLeagueStars: number;
  lowerLeagueId: string;
  lowerLeagueName: string;
  lowerLeagueRank: number;
  lowerLeagueStars: number;
}

interface BaseLdcIssue {
  affectedLeagueIds: string[];
  id: string;
  kind: LdcIssueKind;
  summary: string;
  title: string;
}

export interface DuplicateLdcIssue extends BaseLdcIssue {
  kind: 'duplicate-ldc';
  problem: BasketProblem;
}

export interface OrderConflictIssue extends BaseLdcIssue {
  kind: 'order-conflict';
  problem: OrderProblem;
}

export interface TieringConflictIssue extends BaseLdcIssue {
  kind: 'tiering-conflict';
  problem: TieringProblem;
}

export interface ConsistencyConflictIssue extends BaseLdcIssue {
  duplicateProblem: BasketProblem | null;
  kind: 'consistency-conflict';
  orderProblem: null | OrderProblem;
  tieringProblem: null | TieringProblem;
}

export interface ConfigurationIssue extends BaseLdcIssue {
  kind: 'configuration';
}

export type LdcIssue =
  | ConfigurationIssue
  | ConsistencyConflictIssue
  | DuplicateLdcIssue
  | OrderConflictIssue
  | TieringConflictIssue;

export interface LdcIssueGroup {
  id: LdcIssueKind;
  issues: LdcIssue[];
  label: string;
}

function getLeagueIdByIndex(leagues: LeagueData[], leagueIndex: number, fallbackName: string) {
  return leagues[leagueIndex]?.id ?? `${fallbackName}-${leagueIndex}`;
}

function buildConfigurationIssues(settings: LDCSettings): ConfigurationIssue[] {
  const issues: ConfigurationIssue[] = [];
  const baseLeague = resolveMappingTargetLeague(
    { name: settings.baseLeague, nation: settings.baseLeagueNation ?? '' },
    settings.leagues
  );

  if (baseLeague === null) {
    issues.push({
      affectedLeagueIds: [],
      id: 'configuration-base-league',
      kind: 'configuration',
      summary: `Liga bazowa „${settings.baseLeague}” nie wskazuje jednoznacznie istniejącego rekordu. Obliczenia nie mają prawidłowego punktu odniesienia.`,
      title: 'Nieprawidłowa liga bazowa'
    });
  }

  const nameIndex = buildLeagueNameIndex(settings.leagues);
  settings.leagues.forEach((league, index) => {
    const validationErrors = [
      ...validateLeague(league, index, nameIndex),
      ...(settings.model === 'basket' && league.stars === null
        ? ['Brak gwiazdek; do czasu uzupełnienia liga jest liczona jak tier 0,5']
        : [])
    ];
    if (validationErrors.length === 0) {
      return;
    }

    issues.push({
      affectedLeagueIds: [league.id ?? `${league.name}-${index}`],
      id: `configuration-league-${league.id ?? index}`,
      kind: 'configuration',
      summary: validationErrors.join('; '),
      title: `${league.name || 'Liga bez nazwy'} wymaga poprawy`
    });
  });

  return issues;
}

export function detectTieringConflicts(leagues: LeagueData[]): TieringProblem[] {
  const sortedLeagues = leagues.toSorted((left, right) => left.rank - right.rank);
  const problems: TieringProblem[] = [];

  for (let index = 0; index < sortedLeagues.length - 1; index += 1) {
    const higherLeague = sortedLeagues[index];
    const lowerLeague = sortedLeagues[index + 1];

    if (
      higherLeague.stars === null ||
      lowerLeague.stars === null ||
      lowerLeague.stars <= higherLeague.stars ||
      typeof higherLeague.id !== 'string' ||
      typeof lowerLeague.id !== 'string'
    ) {
      continue;
    }

    problems.push({
      higherLeagueId: higherLeague.id,
      higherLeagueName: higherLeague.name,
      higherLeagueRank: higherLeague.rank,
      higherLeagueStars: higherLeague.stars,
      lowerLeagueId: lowerLeague.id,
      lowerLeagueName: lowerLeague.name,
      lowerLeagueRank: lowerLeague.rank,
      lowerLeagueStars: lowerLeague.stars
    });
  }

  return problems;
}

function buildDuplicateLdcIssues(basketProblems: BasketProblem[]): DuplicateLdcIssue[] {
  return basketProblems.map((problem, index) => ({
    affectedLeagueIds: problem.leagues.map((league) => league.id ?? league.name),
    id: `duplicate-ldc-${index}-${problem.ldcRaw.toFixed(8)}`,
    kind: 'duplicate-ldc',
    problem,
    summary: problem.leagues.map((league) => league.name).join(', '),
    title: `${problem.leagues.length} lig z identycznym LDC_raw (${formatLdcRaw(problem.ldcRaw, 3)})`
  }));
}

function buildOrderConflictIssues(
  settings: LDCSettings,
  orderProblems: OrderProblem[]
): OrderConflictIssue[] {
  return orderProblems.map((problem, index) => ({
    affectedLeagueIds: [
      getLeagueIdByIndex(settings.leagues, problem.league1Index, problem.league1),
      getLeagueIdByIndex(settings.leagues, problem.league2Index, problem.league2)
    ],
    id: `order-conflict-${index}-${problem.league1Index}-${problem.league2Index}`,
    kind: 'order-conflict',
    problem,
    summary: `${problem.league1} ma niższy multiplier niż ${problem.league2}, mimo lepszego rankingu`,
    title: `Konflikt kolejności: rank ${problem.league1Rank} vs ${problem.league2Rank}`
  }));
}

function buildTieringConflictIssues(tieringProblems: TieringProblem[]): TieringConflictIssue[] {
  return tieringProblems.map((problem, index) => ({
    affectedLeagueIds: [problem.higherLeagueId, problem.lowerLeagueId],
    id: `tiering-conflict-${index}-${problem.higherLeagueId}-${problem.lowerLeagueId}`,
    kind: 'tiering-conflict',
    problem,
    summary: `${problem.lowerLeagueName} ma ${problem.lowerLeagueStars.toFixed(1)} gwiazdki mimo gorszego ranku niż ${problem.higherLeagueName}`,
    title: `Niespójny tiering: rank ${problem.higherLeagueRank} i ${problem.lowerLeagueRank}`
  }));
}

function buildConsistencyConflictIssues(
  settings: LDCSettings,
  basketProblems: BasketProblem[],
  orderProblems: OrderProblem[],
  tieringProblems: TieringProblem[]
): ConsistencyConflictIssue[] {
  const issueMap = new Map<string, ConsistencyConflictIssue>();

  orderProblems.forEach((problem, index) => {
    const firstLeagueId = getLeagueIdByIndex(
      settings.leagues,
      problem.league1Index,
      problem.league1
    );
    const secondLeagueId = getLeagueIdByIndex(
      settings.leagues,
      problem.league2Index,
      problem.league2
    );
    const pairIds = [firstLeagueId, secondLeagueId].toSorted((left, right) =>
      left.localeCompare(right)
    );
    const key = pairIds.join('::');

    issueMap.set(key, {
      affectedLeagueIds: pairIds,
      duplicateProblem: null,
      id: `consistency-conflict-order-${index}-${pairIds.join('-')}`,
      kind: 'consistency-conflict',
      orderProblem: problem,
      summary: `${problem.league1} ma niższy multiplier niż ${problem.league2}, mimo lepszego rankingu`,
      tieringProblem: null,
      title: `Niespójność rankingu: rank ${problem.league1Rank} vs ${problem.league2Rank}`
    });
  });

  tieringProblems.forEach((problem, index) => {
    const pairIds = [problem.higherLeagueId, problem.lowerLeagueId].toSorted((left, right) =>
      left.localeCompare(right)
    );
    const key = pairIds.join('::');
    const existingIssue = issueMap.get(key);

    if (existingIssue) {
      existingIssue.id = `consistency-conflict-combined-${index}-${pairIds.join('-')}`;
      existingIssue.summary = `${existingIssue.summary}. ${problem.lowerLeagueName} ma ${problem.lowerLeagueStars.toFixed(1)} gwiazdki mimo gorszego ranku niż ${problem.higherLeagueName}`;
      existingIssue.tieringProblem = problem;
      existingIssue.title = `Niespójność rankingu i tieringu: rank ${problem.higherLeagueRank} i ${problem.lowerLeagueRank}`;
      return;
    }

    issueMap.set(key, {
      affectedLeagueIds: pairIds,
      duplicateProblem: null,
      id: `consistency-conflict-tiering-${index}-${pairIds.join('-')}`,
      kind: 'consistency-conflict',
      orderProblem: null,
      summary: `${problem.lowerLeagueName} ma ${problem.lowerLeagueStars.toFixed(1)} gwiazdki mimo gorszego ranku niż ${problem.higherLeagueName}`,
      tieringProblem: problem,
      title: `Niespójny tiering: rank ${problem.higherLeagueRank} i ${problem.lowerLeagueRank}`
    });
  });

  basketProblems.forEach((problem) => {
    const pairIds = problem.leagues
      .map((league) => league.id ?? league.name)
      .toSorted((left, right) => left.localeCompare(right));
    const key = pairIds.join('::');
    const existingIssue = issueMap.get(key);
    if (!existingIssue) {
      return;
    }

    existingIssue.duplicateProblem = problem;
    existingIssue.summary = `${existingIssue.summary}. Te same ligi wpadają też w identyczny LDC_raw`;
  });

  return [...issueMap.values()];
}

export function buildLdcIssueGroups(
  settings: LDCSettings,
  basketProblems: BasketProblem[],
  orderProblems: OrderProblem[]
): LdcIssueGroup[] {
  const tieringProblems = detectTieringConflicts(settings.leagues);
  const consistencyIssues = buildConsistencyConflictIssues(
    settings,
    basketProblems,
    orderProblems,
    tieringProblems
  );
  const consistencyPairKeys = new Set(
    consistencyIssues.map((issue) =>
      issue.affectedLeagueIds.toSorted((left, right) => left.localeCompare(right)).join('::')
    )
  );
  const duplicateIssues = buildDuplicateLdcIssues(basketProblems);
  const orderIssues = buildOrderConflictIssues(settings, orderProblems);
  const tieringIssues = buildTieringConflictIssues(tieringProblems);

  const groups: LdcIssueGroup[] = [
    {
      id: 'configuration',
      issues: buildConfigurationIssues(settings),
      label: 'Konfiguracja i dane'
    },
    {
      id: 'consistency-conflict',
      issues: consistencyIssues,
      label: 'Konflikty spójności'
    },
    {
      id: 'duplicate-ldc',
      issues: duplicateIssues,
      label: 'Konflikty LDC_raw'
    },
    {
      id: 'order-conflict',
      issues: orderIssues,
      label: 'Konflikty kolejności'
    },
    {
      id: 'tiering-conflict',
      issues: tieringIssues,
      label: 'Niespójny tiering'
    }
  ];

  return groups
    .map((group) =>
      group.id === 'order-conflict' || group.id === 'tiering-conflict'
        ? {
            ...group,
            issues: group.issues.filter(
              (issue) =>
                !consistencyPairKeys.has(
                  issue.affectedLeagueIds
                    .toSorted((left, right) => left.localeCompare(right))
                    .join('::')
                )
            )
          }
        : group
    )
    .map((group) =>
      group.id === 'duplicate-ldc'
        ? {
            ...group,
            issues: group.issues.filter(
              (issue) =>
                !consistencyPairKeys.has(
                  issue.affectedLeagueIds
                    .toSorted((left, right) => left.localeCompare(right))
                    .join('::')
                )
            )
          }
        : group
    )
    .filter((group) => group.issues.length > 0);
}
