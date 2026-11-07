/* eslint-disable fp/no-let, fp/no-mutation -- LDC lookup helpers intentionally read shared caches and legacy singleton settings. */

import { type ClubLeague, type LdcPlayerRow, ldcCache, ldcSettings } from '../config/ldcConfig';
import { getPlayerRuntimeRows } from '../lib/playerRuntimeCache';

import {
  createLeagueIdentityKey,
  getMappingTarget,
  getMappingTargetName,
  getMappingTargetNation,
  loadLeagueMappings
} from './ldcMappings';
import { canonicalizeNation } from './ldcNations';
import { autoMapLeague, isFreeAgent, normalizeLeagueNameForGrouping } from './ldcUtils';

export function getLDCForLeague(
  leagueName: string,
  _clubName: null | string = null,
  playerCountry: null | string = null
): number {
  if (!ldcSettings.enabled || !leagueName) return 1;
  return getLDCForLeagueRaw(leagueName, canonicalizeNation(playerCountry));
}

export function getLDCForLeagueRaw(leagueName: string, leagueNation = ''): number {
  if (!ldcSettings.enabled || !leagueName) return 1;

  const mappings = loadLeagueMappings();
  const mappedTarget = getMappingTarget(mappings, leagueName, leagueNation);
  let searchName = getMappingTargetName(mappedTarget) || leagueName;

  if (!mappedTarget) {
    const autoMapped = autoMapLeague(leagueName);
    if (autoMapped) {
      searchName = autoMapped;
    }
  }

  const targetNation = getMappingTargetNation(mappedTarget) || leagueNation;
  let multiplier = targetNation
    ? ldcCache.get(createLeagueIdentityKey(searchName, targetNation))
    : undefined;
  if (multiplier !== undefined) return multiplier;

  if (!targetNation) {
    multiplier = ldcCache.get(searchName);
    if (multiplier !== undefined) return multiplier;
  }

  const normalized = normalizeLeagueNameForGrouping(searchName);
  multiplier = targetNation
    ? ldcCache.get(createLeagueIdentityKey(normalized, targetNation))
    : undefined;
  if (multiplier !== undefined) return multiplier;

  if (!targetNation) {
    multiplier = ldcCache.get(normalized);
    if (multiplier !== undefined) return multiplier;
  }

  return 1;
}

export function findClubLeagues(clubName: string, countryCode: null | string = null): ClubLeague[] {
  const playerRows = getPlayerRuntimeRows();
  if (!clubName || playerRows.length === 0) return [];

  const clubLeagues = new Map<string, ClubLeague>();
  playerRows.forEach((player) => {
    if (player.Club === clubName && player.Division) {
      const division = player.Division.trim();
      if (!isFreeAgent(division)) {
        const playerCountry = player['Based In'] || '';

        if (countryCode && playerCountry !== countryCode) return;

        const key = `${division}|${playerCountry}`;

        if (!clubLeagues.has(key)) {
          clubLeagues.set(key, {
            country: playerCountry,
            league: division,
            multiplier: getLDCForLeagueRaw(division, canonicalizeNation(playerCountry))
          });
        }
      }
    }
  });

  return [...clubLeagues.values()];
}

export function identifyReserveTeamLeague(_clubName: string, leagues: ClubLeague[]): null | string {
  if (leagues.length < 2) return null;

  const sorted = [...leagues].toSorted((a, b) => a.multiplier - b.multiplier);

  if (sorted.length >= 2 && sorted[1].multiplier > sorted[0].multiplier * 1.2) {
    return sorted[0].league;
  }

  return null;
}

/**
 * LDC reserve-team detection, not wired yet. Unused today; kept until the React/TS migration decides its fate.
 * @public
 */
export function detectReserveTeam(
  leagueName: string,
  clubName: string,
  playerCountry: null | string = null
): null | { isReserve: boolean; mainLeague: null | string } {
  if (!ldcSettings.enabled || !clubName) return null;

  const clubLeagues = findClubLeagues(clubName, playerCountry);
  if (clubLeagues.length < 2) return null;

  const sameCountryLeagues = playerCountry
    ? clubLeagues.filter((league) => league.country === playerCountry)
    : clubLeagues;

  if (sameCountryLeagues.length < 2) return null;

  const reserveLeague = identifyReserveTeamLeague(clubName, sameCountryLeagues);
  if (reserveLeague === leagueName) {
    return {
      isReserve: true,
      mainLeague:
        sameCountryLeagues.find(
          (league) =>
            league.league !== leagueName && league.multiplier > getLDCForLeagueRaw(leagueName)
        )?.league || null
    };
  }

  return null;
}

export function getPlayerLeagueMultiplier(player: LdcPlayerRow | null | undefined): number {
  if (!player || !ldcSettings.enabled) return 1;
  const league = player.Division;
  if (!league || isFreeAgent(league)) return 1;
  const clubName = player.Club ?? null;
  const playerCountry = player['Based In'] || null;
  return getLDCForLeague(league, clubName, playerCountry);
}

export function filterPlayersByLDC(
  players: LdcPlayerRow[],
  minMultiplier: null | number = null,
  maxMultiplier: null | number = null
): LdcPlayerRow[] {
  if (!ldcSettings.enabled || (!minMultiplier && !maxMultiplier)) return players;

  return players.filter((player) => {
    const multiplier = getPlayerLeagueMultiplier(player);
    if (minMultiplier !== null && multiplier < minMultiplier) return false;
    if (maxMultiplier !== null && multiplier > maxMultiplier) return false;
    return true;
  });
}
