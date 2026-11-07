import type { TieringProblem } from './ldcIssues';
import type { LeagueData } from '@/config/ldcConfig';

function clampStars(stars: number) {
  return Math.max(0.5, Math.min(5, Math.round(stars * 2) / 2));
}

function byRank(left: LeagueData, right: LeagueData) {
  return left.rank - right.rank;
}

export function alignStarsToRank(leagues: LeagueData[]) {
  const sortedLeagues = structuredClone(leagues).toSorted(byRank);
  const bucketSize = Math.max(1, Math.ceil(sortedLeagues.length / 10));

  return sortedLeagues.map((league, index) => ({
    ...league,
    stars: clampStars(5 - Math.floor(index / bucketSize) * 0.5)
  }));
}

export function alignRankToStars(leagues: LeagueData[]) {
  return structuredClone(leagues)
    .toSorted((left, right) => {
      const leftStars = left.stars ?? -1;
      const rightStars = right.stars ?? -1;
      if (leftStars !== rightStars) {
        return rightStars - leftStars;
      }

      return left.rank - right.rank;
    })
    .map((league, index) => ({
      ...league,
      rank: index + 1
    }));
}

export function repairTieringConflicts(leagues: LeagueData[]) {
  const sortedLeagues = structuredClone(leagues).toSorted(byRank);

  for (let index = 1; index < sortedLeagues.length; index += 1) {
    const previousLeague = sortedLeagues[index - 1];
    const currentLeague = sortedLeagues[index];
    if (previousLeague.stars === null || currentLeague.stars === null) {
      continue;
    }

    if (currentLeague.stars > previousLeague.stars) {
      currentLeague.stars = previousLeague.stars;
    }
  }

  return sortedLeagues;
}

export function repairDuplicateLdcLeagues(leagues: LeagueData[], affectedLeagueIds: string[]) {
  const affectedLeagueIdsSet = new Set(affectedLeagueIds);
  const nextLeagues = structuredClone(leagues).toSorted(byRank);
  const conflictingLeagues = nextLeagues.filter((league) =>
    affectedLeagueIdsSet.has(league.id ?? league.name)
  );

  for (let index = 1; index < conflictingLeagues.length; index += 1) {
    const previousLeague = conflictingLeagues[index - 1];
    const currentLeague = conflictingLeagues[index];

    if (currentLeague.stars === null || previousLeague.stars === null) {
      continue;
    }

    const loweredStars = clampStars(Math.min(previousLeague.stars, currentLeague.stars) - 0.5);
    currentLeague.stars =
      loweredStars === currentLeague.stars ? clampStars(currentLeague.stars - 0.5) : loweredStars;
  }

  return nextLeagues;
}

export function repairOrderConflict(leagues: LeagueData[], affectedLeagueIds: string[]) {
  const affectedLeagueIdsSet = new Set(affectedLeagueIds);
  const nextLeagues = structuredClone(leagues).toSorted(byRank);
  const affectedIndices = nextLeagues
    .map((league, index) => (affectedLeagueIdsSet.has(league.id ?? league.name) ? index : -1))
    .filter((index) => index >= 0);

  if (affectedIndices.length !== 2) {
    return nextLeagues;
  }

  const [firstIndex, secondIndex] = affectedIndices;
  [nextLeagues[firstIndex], nextLeagues[secondIndex]] = [
    nextLeagues[secondIndex],
    nextLeagues[firstIndex]
  ];

  return nextLeagues.map((league, index) => ({
    ...league,
    rank: index + 1
  }));
}

// eslint-disable-next-line sonarjs/no-invariant-returns
export function repairSingleTieringConflict(leagues: LeagueData[], problem: TieringProblem) {
  const nextLeagues = structuredClone(leagues).toSorted(byRank);
  const lowerLeague = nextLeagues.find((league) => league.id === problem.lowerLeagueId);
  const higherLeague = nextLeagues.find((league) => league.id === problem.higherLeagueId);

  if (!lowerLeague || !higherLeague || lowerLeague.stars === null || higherLeague.stars === null) {
    return nextLeagues;
  }

  lowerLeague.stars = higherLeague.stars;
  return nextLeagues;
}
