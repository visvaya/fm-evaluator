/* eslint-disable fp/no-delete, fp/no-let, fp/no-mutation -- LDC stat application mutates player rows by design. */

import { type LdcPlayerRow, ldcSettings } from '../config/ldcConfig';
import { NEGATIVE_STATS } from '../config/scoreConfig';

import { getLDCForLeague } from './ldcLeagueLookup';

export const LDC_VOLUME_STATS = [
  'Gls',
  'xG',
  'xA',
  'OP-KP',
  'Shots',
  'xA/90',
  'Gls/90',
  'Shots/90',
  // Shot/90 is a plain alias of Shots/90 created in deriveStats before LDC
  // runs; without it here the alias would keep the raw value and let filters
  // that key off Shot/90 see an unadjusted stat for weak-league players.
  'Shot/90',
  'ShT/90',
  'Pas C/90',
  'Pas A/90',
  'Drb/90',
  'OP-Crs C/90',
  'Int/90',
  'Tck C/90',
  'Hdrs W/90',
  'Tck/90',
  'Poss Won/90',
  'Poss Lost/90',
  'OP-KP/90',
  'CCC/90',
  'OP-Crs A/90',
  'Poss+/-/90',
  'Pres A/90',
  'Pr Passes/90',
  'Net Fouls/90',
  'K Hdrs/90',
  'Aer A/90',
  'Tck A/90',
  'K Tck/90',
  'Shts Out/90',
  'Shts In/90',
  'NP-xG/90',
  'NP-Gls-NP-xG/90',
  'xGP/90',
  // Physical volume stats used as key stats by several roles (see
  // STATS_CONFIG); a weaker league's higher raw distance/sprint counts do
  // not reflect superior work-rate against stronger opposition.
  'Dist/90',
  'Sprints/90',
  // Verified against POSITION_FILTERS (the eligibility-gate thresholds, a
  // different config from STATS_CONFIG) - all are real per-90 volume stats
  // used as filter thresholds for at least one role and were previously
  // uncorrected, letting a weak-league player's inflated raw value pass a
  // threshold it should not have.
  'Blk/90',
  'Ch C/90',
  // Clr/90, Svp/90 and Svt/90 have a POSITION_FILTERS `{ max }` ceiling for
  // GK (scorePostProcessing.ts gates eligibility on value <= max), but that
  // is an unrelated style/workload filter, not a "lower is better" signal -
  // it excludes keepers whose save profile leans too heavily on parrying/
  // tipping over clean catches, or who face an unusually heavy defensive
  // workload. The stat itself is still a positive defensive accomplishment
  // (a clearance or a save, however taken), so LDC direction is governed by
  // NEGATIVE_STATS (scoreConfig.ts) as with every other volume stat, and
  // these three are deliberately absent from that list. Do not "fix" this
  // into an inverse adjustment just because a POSITION_FILTERS max exists.
  'Clr/90',
  'Hdrs A/90',
  'K Ps/90',
  'Saves/90',
  'Svh/90',
  'Svp/90',
  'Svt/90',
  // Lower-is-better volume stats (already in NEGATIVE_STATS, so they get the
  // inverse adjustment automatically) also used as filter thresholds.
  'Fls Made/90',
  'Tck Failed/90'
] as const;

const lowerIsBetterStats = new Set<string>(NEGATIVE_STATS);
const signedHigherIsBetterStats = new Set<string>([
  'Net Fouls/90',
  'NP-Gls-NP-xG/90',
  'Poss+/-/90',
  'xGP/90'
]);

/**
 * Upper bound for the inverse (division-based) adjustment factor.
 * Direct adjustment shrinks values toward zero and is naturally bounded;
 * inverse adjustment is unbounded and would let a single weak-league player
 * distort stat distributions, so 1/multiplier is capped at this factor.
 */
export const INVERSE_ADJUSTMENT_MAX_FACTOR = 100;

function inverseAdjust(value: number, multiplier: number) {
  const effectiveMultiplier = Math.max(multiplier, 1 / INVERSE_ADJUSTMENT_MAX_FACTOR);
  return value / effectiveMultiplier;
}

export function adjustLdcStatValue(stat: string, value: number, multiplier: number) {
  if (lowerIsBetterStats.has(stat)) {
    return inverseAdjust(value, multiplier);
  }

  if (signedHigherIsBetterStats.has(stat) && value < 0) {
    return inverseAdjust(value, multiplier);
  }

  return value * multiplier;
}

/**
 * Adjusted stats are stored as strings (consistent with deriveStats output).
 * Small magnitudes keep 6 significant digits in plain fixed-point notation -
 * NEVER scientific notation, because the shared parseNumber() strips the "e"
 * and would read 5.00000e-9 as 5.
 */
export function formatAdjustedStat(value: number): string {
  if (value === 0 || Math.abs(value) >= 0.01) {
    return value.toFixed(2);
  }

  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const decimals = Math.min(20, 5 - magnitude);
  return value.toFixed(decimals);
}

function statText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

export function restoreOriginalStats(player: LdcPlayerRow): void {
  Object.keys(player).forEach((key) => {
    if (key.endsWith('_original')) {
      const statName = key.replace('_original', '');
      player[statName] = player[key];
      delete player[key];
      delete player[`${statName}_ldc_multiplier`];
    }
  });
}

export function applyLDCToStats(player: LdcPlayerRow): void {
  if (!ldcSettings.enabled) {
    restoreOriginalStats(player);
    return;
  }

  const league = player.Division;
  if (!league) {
    restoreOriginalStats(player);
    return;
  }

  const clubName = player.Club;
  const playerCountry = player['Based In'] || null;
  const multiplier = getLDCForLeague(league, clubName, playerCountry);
  if (multiplier === 1) {
    restoreOriginalStats(player);
    return;
  }

  LDC_VOLUME_STATS.forEach((stat) => {
    if (player[stat] !== undefined && player[stat] !== null && player[stat] !== '') {
      let originalValue = player[`${stat}_original`] as number | undefined;
      if (originalValue === undefined) {
        const parsedValue = parseFloat(statText(player[stat]));
        // Never back up unparsable values (e.g. "-") as NaN; a NaN backup
        // would overwrite the real source value on the next restore.
        if (!Number.isFinite(parsedValue)) {
          return;
        }
        originalValue = parsedValue;
        player[`${stat}_original`] = originalValue;
      }

      if (!isNaN(originalValue)) {
        const adjustedValue = adjustLdcStatValue(stat, originalValue, multiplier);
        player[stat] = formatAdjustedStat(adjustedValue);
        player[`${stat}_ldc_multiplier`] = multiplier;
      }
    }
  });
}

export function getLDCTooltip(statName: string, player: LdcPlayerRow): string {
  if (!ldcSettings.enabled) return '';
  const original = player[`${statName}_original`] as number | undefined;
  const multiplier = player[`${statName}_ldc_multiplier`] as number | undefined;
  if (original !== undefined && multiplier !== undefined && multiplier !== 1) {
    return `Po przemnożeniu: ${statText(player[statName])} (Przed: ${original.toFixed(2)})`;
  }
  return '';
}
