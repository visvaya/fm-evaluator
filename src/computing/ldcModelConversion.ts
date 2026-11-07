import type { LDCModel, LeagueData } from '@/config/ldcConfig';

function starsForRank(rank: number) {
  return Math.max(0.5, 5 - (Math.max(1, rank) - 1) * 0.5);
}

export function convertLeaguesForModel(
  leagues: readonly LeagueData[],
  model: LDCModel
): LeagueData[] {
  return leagues.map((league) => ({
    ...league,
    stars: model === 'basket' && league.stars === null ? starsForRank(league.rank) : league.stars
  }));
}
