/* eslint-disable @typescript-eslint/consistent-type-definitions, id-match, sonarjs/cognitive-complexity, sonarjs/max-lines-per-function, unicorn/prefer-ternary */
import { useSettingsStore } from '../store/useSettingsStore';

import { applyAttackingDerivations } from './deriveStatsAttacking';
import { applyGoalkeepingDerivations } from './deriveStatsGoalkeeping';
import { applyPAdjDerivations } from './deriveStatsPAdj';
import { applyTailDerivations } from './deriveStatsTail';

type DeriveStatsArgs = {
  cleanValue: (value: unknown) => any;
  defaultPossession: number;
  getTeamPossession: (clubName: unknown) => number | null;
  player: Record<string, any>;
};
export function deriveProcessorStats({
  cleanValue,
  defaultPossession,
  getTeamPossession,
  player
}: DeriveStatsArgs) {
  const getV = (k) => cleanValue(player[k]);
  const mins = getV('Mins') || 0;
  if (mins < 1) return;
  const factor90 = 90 / mins;
  const getN = (k) => getV(k) || 0;
  const hasValue = (k) => player[k] !== undefined && player[k] !== null && player[k] !== '';

  // Helper function to check if raw value from file is empty ('-', null, 0)
  const isRawEmpty = (k) => {
    const raw = player[k];
    if (raw === null || raw === undefined || raw === '') return true;
    if (raw === '-') return true;
    const num = cleanValue(raw);
    return num === null || num === 0;
  };

  // 0. Preferred Foot Calculation
  if (!player.basic_preferred_foot) {
    const left = getN('basic_left_foot');
    const right = getN('basic_right_foot');
    if (left > 0 || right > 0) {
      if (left === right && left >= 4) player.basic_preferred_foot = 'Obie';
      else if (left >= right) player.basic_preferred_foot = 'Lewa';
      else player.basic_preferred_foot = 'Prawa';
      player['Preferred Foot'] = player.basic_preferred_foot; // Fallback
    }
  }

  // 0.1 Dynamic Passing Stats
  const pasC = getV('statistic_passes_completed');
  const pasA = getV('statistic_passes_attempted');
  if (pasA && pasA > 0) {
    player['Pas %'] = ((pasC / pasA) * 100).toFixed(1);
    player['Pas A/90'] = (pasA * factor90).toFixed(2);
  }

  // 0.2 Dynamic Tackling Stats
  const tckC = getV('statistic_tackles_completed');
  const tckA = getV('statistic_tackles_attempted');
  if (tckA && tckA > 0) {
    player['Tck %'] = ((tckC / tckA) * 100).toFixed(1);
    player['Tck A/90'] = (tckA * factor90).toFixed(2);
  }

  // 0.3 Dynamic Possession Balance
  const pw = getV('statistic_possession_won_per_90');
  const pl = getV('statistic_possession_lost_per_90');
  if (pw !== null && pl !== null) {
    player['Poss+/-/90'] = (pw - pl).toFixed(2);
  }

  // 0.4 Dynamic Statistic Calculations (from raw integers to per-90)
  const statsMap = {
    'Asts/90': 'statistic_assists',
    'Blk/90': 'statistic_blocks',
    'Clr/90': 'statistic_clearances',
    'Con/90': 'statistic_goals_conceded',
    'Drb/90': 'statistic_dribbles',
    'FA/90': 'statistic_fouls_against',
    'Fls Made/90': 'statistic_fouls',
    'Gls/90': 'statistic_goals',
    'Int/90': 'statistic_interceptions',
    'K Ps/90': 'statistic_key_passes',
    'K Tck/90': 'statistic_key_tackles',
    'OP-KP/90': 'statistic_open_play_key_passes',
    'Pas A/90': 'statistic_passes_attempted',
    'Pas C/90': 'statistic_passes_completed',
    'Pr Passes/90': 'statistic_progressive_passes',
    'Red/90': 'statistic_red_cards',
    'Shots/90': 'statistic_shots',
    'ShT/90': 'statistic_shots_on_target',
    'Svh/90': 'statistic_saves_held',
    'Svp/90': 'statistic_saves_parried',
    'Svt/90': 'statistic_saves_tipped',
    'xA/90': 'statistic_xa',
    'Yel/90': 'statistic_yellow_cards'
  };

  for (const [key, schemaId] of Object.entries(statsMap)) {
    const val = getV(schemaId);
    if (val !== null && !hasValue(key)) {
      player[key] = (val * factor90).toFixed(2);
    }
  }

  // 0.5 Dynamic Percentage Rates
  // Header Win %
  if (!hasValue('Hdr %')) {
    const hdrsW = getV('statistic_headers_won');
    const hdrsA = getV('statistic_headers_attempted');
    if (hdrsA > 0 && hdrsW !== null) {
      player['Hdr %'] = ((hdrsW / hdrsA) * 100).toFixed(2);
      player['Hdrs W/90'] = (hdrsW * factor90).toFixed(2);
    }
  }

  // Shot on Target %
  if (!hasValue('ShT %')) {
    const sht = getV('statistic_shots_on_target');
    const sh = getV('statistic_shots');
    if (sh > 0 && sht !== null) {
      player['ShT %'] = ((sht / sh) * 100).toFixed(2);
    }
  }

  // Conversion %
  if (!hasValue('Conv %')) {
    const gls = getV('statistic_goals');
    const sh = getV('statistic_shots');
    if (sh > 0 && gls !== null) {
      player['Conv %'] = ((gls / sh) * 100).toFixed(2);
    }
  }

  // Save % (Goalies)
  if (!hasValue('Sv %')) {
    const conc = getV('statistic_goals_conceded') || 0;
    const svh = getV('statistic_saves_held') || 0;
    const svp = getV('statistic_saves_parried') || 0;
    const svt = getV('statistic_saves_tipped') || 0;
    const totalSaves = svh + svp + svt;
    const totalShotsFaced = totalSaves + conc;
    if (totalShotsFaced > 0) {
      player['Sv %'] = ((totalSaves / totalShotsFaced) * 100).toFixed(2);
      player['Save Efficiency'] = player['Sv %']; // Fallback
    }
  }

  // Tackling fallback & Tck R (Tackle Ratio/Rate)
  if (!hasValue('Tck W %') && player['Tck %']) {
    player['Tck W %'] = player['Tck %'];
  }
  if (!hasValue('Tck R') && player['Tck W %']) {
    player['Tck R'] = player['Tck W %'];
  }

  // Shot/90 Alias
  if (!hasValue('Shot/90') && hasValue('Shots/90')) {
    player['Shot/90'] = player['Shots/90'];
  }

  // Advanced Shooting Stats (In-Box)
  if (!hasValue('Gls In Box %') || !hasValue('In Box Conv %') || !hasValue('Shts In %')) {
    const glsTotal = getV('statistic_goals');
    const glsOutside = getV('statistic_goals_outside_box');
    const shotsTotal = getV('statistic_shots');
    const shotsOutside90 = getV('statistic_shots_outside_box_per_90');

    if (glsTotal !== null && glsOutside !== null && glsTotal > 0) {
      const glsInside = glsTotal - glsOutside;
      player['Gls In Box %'] = ((glsInside / glsTotal) * 100).toFixed(2);

      if (shotsTotal !== null && shotsOutside90 !== null && mins > 0) {
        const rawShotsOutside = shotsOutside90 * (mins / 90);
        const shotsInside = Math.max(0, shotsTotal - rawShotsOutside);
        if (shotsInside > 0) {
          player['In Box Conv %'] = ((glsInside / shotsInside) * 100).toFixed(2);
          player['Shts In %'] = ((shotsInside / shotsTotal) * 100).toFixed(2);
        }
      }
    }
  }

  // 1. NP-xG/90 (Expected Non-penalty Goals per 90 minutes)
  // Formula: MAX(0, xG - penaltyXGFactor*Pens) * factor90
  // Compute NP-xG once with MAX(0, ...) to avoid negative values
  const penaltyFactor = useSettingsStore.getState().settings.penaltyXGFactor || 0.76;
  let np_xG = getV('NP-xG');
  if (np_xG === null && getV('xG') !== null) {
    np_xG = Math.max(0, getN('xG') - penaltyFactor * getN('Pens'));
  } else if (np_xG !== null) {
    np_xG = Math.max(0, np_xG);
  }

  if (!hasValue('NP-xG/90') && np_xG !== null) {
    player['NP-xG/90'] = (np_xG * factor90).toFixed(2);
  }

  // 2. NP-Gls-NP-xG/90 = Non-penalty Goals minus Non-penalty Expected Goals per 90
  // Formula: ((Gls - Pens S) - MAX(0, xG - penaltyXGFactor*Pens)) * factor90
  // Uses the same np_xG with MAX(0, ...) as NP-xG/90 (computed with penaltyXGFactor)
  // Group 1: Skill/Role Specific - requires base value (xG or Gls)
  if (!hasValue('NP-Gls-NP-xG/90')) {
    // Check if BOTH raw xG and Gls values are empty ('-' or 0) - inactivity penalty
    if (isRawEmpty('xG') && isRawEmpty('Gls')) {
      player['NP-Gls-NP-xG/90'] = null; // Penalty: no base activity
    } else {
      const gls = getV('Gls');
      const xG = getV('xG');

      // If the player has no goals and no xG, set null
      if (gls === null && xG === null) {
        player['NP-Gls-NP-xG/90'] = null;
      } else {
        const np_gls = getN('Gls') - getN('Pens S'); // Non-penalty goals
        // Use the same np_xG with MAX(0, ...) computed above
        if (np_xG !== null) {
          const diff = np_gls - np_xG;
          player['NP-Gls-NP-xG/90'] = (diff * factor90).toFixed(2);
        }
      }
    }
  }

  // 3. Poss+/-/90: Poss Won/90 - Poss Lost/90
  // Note: Poss Won and Poss Lost are always per-90 values in the source files
  // Group 2: Volume/Difference - requires ANY activity on either side
  if (!hasValue('Poss+/-/90')) {
    // Read the per-90 values (possible aliases)
    let possWon90 = getV('Poss Won/90');
    if (possWon90 === null) possWon90 = getV('Possession Won/90');
    if (possWon90 === null) possWon90 = getV('Poss Won'); // Poss Won is already per 90
    let possLost90 = getV('Poss Lost/90');
    if (possLost90 === null) possLost90 = getV('Possession Lost/90');
    if (possLost90 === null) possLost90 = getV('Poss Lost'); // Poss Lost is already per 90

    // Critical condition: if BOTH components are 0 or null, return NULL (inactivity)
    const wonValue = possWon90 ?? 0;
    const lostValue = possLost90 ?? 0;
    if (wonValue === 0 && lostValue === 0) {
      player['Poss+/-/90'] = null; // Penalty: no activity
    } else {
      // Compute the difference (at least one component > 0, so a zero here is an active zero)
      player['Poss+/-/90'] = (wonValue - lostValue).toFixed(2);
    }
  }

  // Net Fouls/90
  // Group 2: Volume/Difference - requires ANY activity on either side
  if (!hasValue('Net Fouls/90')) {
    // Read the cleaned numeric values of both components
    const fa = getV('FA') ?? 0;
    const fls = getV('Fls') ?? 0;

    // Critical condition: if BOTH components are 0 or null, return NULL (inactivity)
    if (fa === 0 && fls === 0) {
      player['Net Fouls/90'] = null; // Penalty: no activity
    } else {
      // Compute the difference (at least one component > 0, so a zero here is an active zero)
      player['Net Fouls/90'] = ((fa - fls) * factor90).toFixed(2);
    }
  }

  // 4. CCC/90
  if (!hasValue('CCC/90') && getV('CCC') !== null)
    player['CCC/90'] = (getV('CCC') * factor90).toFixed(2);

  // 5. Shts In/90 & Shts Out/90
  // Shts In/90 = (Shots * factor90) - (Shots Outside Box/90 or Shts Out * factor90)
  // 'Shots/90' does not exist in the original file, so 'Shots' is used and converted
  if (!hasValue('Shts In/90')) {
    let shots90 = getV('Shots/90');
    // If Shots/90 is missing, compute it from Shots
    if (shots90 === null) {
      const shots = getV('Shots');
      if (shots !== null) {
        shots90 = shots * factor90;
      }
    }

    let shtsOut90 = getV('Shots Outside Box/90');
    if (shtsOut90 === null) shtsOut90 = getV('Shts Out/90');
    // Fallback: if Shots Outside Box/90 is missing, compute it from Shts Out
    if (shtsOut90 === null) {
      const shtsOut = getV('Shts Out');
      if (shtsOut !== null) {
        shtsOut90 = shtsOut * factor90;
      }
    }

    if (shots90 !== null && shtsOut90 !== null) {
      // GUARD: shots from outside the box cannot exceed total shots
      // (Protects against errors in the source data or unit differences)
      shtsOut90 = Math.min(shtsOut90, shots90);

      // Compute shots inside the box (cannot be negative)
      const shtsIn90 = Math.max(0, shots90 - shtsOut90);

      player['Shts In/90'] = shtsIn90.toFixed(2);
    }
  }

  // Shts Out/90 = Shots Outside Box/90 (directly from the file)
  if (!hasValue('Shts Out/90')) {
    const shtsOut90 = getV('Shots Outside Box/90');
    if (shtsOut90 !== null) {
      player['Shts Out/90'] = shtsOut90.toFixed(2);
    }
  }

  // 6. Dist/90: use 'Distance' (not 'Dist/90', which is broken in the files: always '0.0km')
  // Always computed from 'Distance', ignoring 'Dist/90' from the file
  // Distance may have a 'km' suffix; cleanValue should handle it
  let dist = getV('Distance');
  // Fallback to alternative keys
  if (dist === null) dist = getV('Dist');
  if (dist === null) dist = getV('Distance Covered');
  if (dist !== null) {
    player['Dist/90'] = (dist * factor90).toFixed(2);
  }

  if (!hasValue('Pr Passes/90') && getV('Pr Passes') !== null)
    player['Pr Passes/90'] = (getV('Pr Passes') * factor90).toFixed(2);

  // 7. CCC % (Conversion ratio of created chances into CCC)
  // CCC % = (CCC / Ch C) * 100
  // Note: the source data has no 'Ch C', only 'Ch C/90'
  // Ch C is computed from Ch C/90: Ch C = Ch C/90 * (Mins/90)
  // Validation: if ccc > chC, set 100%
  if (!hasValue('CCC %')) {
    const ccc = getV('CCC');
    let chC90 = getV('Ch C/90');
    if (chC90 === null) chC90 = getV('Chances Created/90');
    if (chC90 !== null && mins > 0) {
      // STEP 1: Rebuild from the per-90 value
      const rawChC = chC90 * (mins / 90);
      // STEP 2: Round to an integer, because chances are discrete
      const chC = Math.round(rawChC);
      if (ccc !== null && chC > 0) {
        // Logical guard: CCC cannot be greater than Ch C
        if (ccc <= chC) {
          const percentage = (ccc / chC) * 100;
          // Validation: the percentage must be within 0-100%
          if (percentage >= 0 && percentage <= 100) {
            player['CCC %'] = percentage.toFixed(2);
          }
        } else {
          // If ccc > chC (data error), set 100% as the maximum
          player['CCC %'] = '100.00';
        }
      }
    }
  }

  // 8. OP-KP % (Open Play Key Passes %)
  // OP-KP % = (OP-KP / Pas A) * 100 (Percentage of Open Play Key Passes per Attempted Pass)
  if (!hasValue('OP-KP %')) {
    const opkp = getV('OP-KP');
    let pasA = getV('Pas A');
    if (pasA === null) pasA = getV('Ps A');
    if (pasA === null) pasA = getV('Passes Attempted');
    // Logical guard: OP-KP <= Pas A
    if (opkp !== null && pasA !== null && pasA > 0 && opkp <= pasA) {
      const percentage = (opkp / pasA) * 100;
      // Validation: the percentage must be within 0-100%
      if (percentage >= 0 && percentage <= 100) {
        player['OP-KP %'] = percentage.toFixed(2);
      }
    }
  }

  // 9. OP-Crs C % (Open Play Cross Completion)
  if (!hasValue('OP-Crs C %')) {
    // First check if pre-calculated value exists in file (OP-Cr %)
    let opCrPercent = getV('OP-Cr %');
    if (opCrPercent !== null) {
      // Convert to percentage if needed (might already be percentage)
      if (opCrPercent <= 1) opCrPercent = opCrPercent * 100;
      if (opCrPercent >= 0 && opCrPercent <= 100) {
        player['OP-Crs C %'] = opCrPercent.toFixed(2);
      }
    } else if (getV('OP-Crs C') !== null && getV('OP-Crs A') !== null) {
      // Calculate from OP-Crs C and OP-Crs A
      const opCrsC = getV('OP-Crs C');
      const att = getV('OP-Crs A');
      // Logical guard: OP-Crs C <= OP-Crs A
      if (att > 0 && opCrsC !== null && opCrsC <= att) {
        const percentage = (opCrsC / att) * 100;
        // Validation: the percentage must be within 0-100%
        if (percentage >= 0 && percentage <= 100) {
          player['OP-Crs C %'] = percentage.toFixed(2);
        }
      }
    }
  }

  if (!hasValue('Pres C %') && getV('Pres C') !== null && getV('Pres A') !== null) {
    const presC = getV('Pres C');
    const presA = getV('Pres A');
    // Logical guard: Pres C <= Pres A
    if (presA > 0 && presC !== null && presC <= presA) {
      const percentage = (presC / presA) * 100;
      // Validation: the percentage must be within 0-100%
      if (percentage >= 0 && percentage <= 100) {
        player['Pres C %'] = percentage.toFixed(2);
      }
    }
  }

  // 10. Duels Win %
  // Formula: ((Hdrs + Tck C) / (Hdrs A + Tck A)) * 100
  // Pre-filter: minimum 10 Hdrs A and minimum 10 Tck A, otherwise '0.00'
  if (!hasValue('Duels Win %')) {
    const hdrsA = getN('Hdrs A');
    let tckA = getV('Tck A');
    if (tckA === null) tckA = getV('Tackles Attempted');
    if (tckA === null) tckA = 0;

    // Pre-filter
    if (hdrsA < 10 || tckA < 10) {
      player['Duels Win %'] = '0.00';
    } else {
      const hdrs = getN('Hdrs');
      let tckC = getV('Tck C');
      if (tckC === null) tckC = getV('Tackles Completed');
      if (tckC === null) tckC = 0;

      const won = hdrs + tckC;
      const att = hdrsA + tckA;

      // Logical guard: won <= att (wins cannot exceed attempts)
      if (att > 0 && won <= att) {
        const percentage = (won / att) * 100;
        // Validation: the percentage must be within 0-100%
        player['Duels Win %'] =
          percentage >= 0 && percentage <= 100 ? percentage.toFixed(2) : '0.00';
      }
    }
  }

  if (!hasValue('Tck A/90')) {
    let tckA = getV('Tck A');
    if (tckA === null) tckA = getV('Tackles Attempted');
    if (tckA === null && getV('Tck C') !== null && getV('Tck R') !== null) {
      tckA = getV('Tck C') / (getV('Tck R') / 100);
    }
    if (tckA !== null) player['Tck A/90'] = (tckA * factor90).toFixed(2);
  }
  if (!hasValue('Tck Qual') && getN('Fls') > 0) {
    let tckA = getV('Tck A');
    if (tckA === null) tckA = getV('Tackles Attempted');
    if (tckA !== null && tckA > 0) {
      player['Tck Qual'] = (tckA / getN('Fls')).toFixed(2);
    }
  }

  if (!hasValue('Pas C/90') && getV('Pas C') !== null) {
    player['Pas C/90'] = (getV('Pas C') * factor90).toFixed(2);
  }

  applyGoalkeepingDerivations({ factor90, getN, getV, hasValue, mins, player });

  // 12a. Saves Held/90, Saves Tipped/90, Saves Parried/90
  if (!hasValue('Svh/90') && getV('Svh') !== null) {
    player['Svh/90'] = (getN('Svh') * factor90).toFixed(2);
  }
  if (!hasValue('Svt/90') && getV('Svt') !== null) {
    player['Svt/90'] = (getN('Svt') * factor90).toFixed(2);
  }
  if (!hasValue('Svp/90') && getV('Svp') !== null) {
    player['Svp/90'] = (getN('Svp') * factor90).toFixed(2);
  }

  // 12b. Tackles Failed/90
  if (!hasValue('Tck Failed/90')) {
    let tckA = getV('Tck A');
    if (tckA === null) tckA = getV('Tackles Attempted');
    let tckC = getV('Tck C');
    if (tckC === null) tckC = getV('Tackles Completed');
    if (tckA !== null && tckC !== null) {
      const tckFailed = tckA - tckC;
      if (tckFailed >= 0) {
        player['Tck Failed/90'] = (tckFailed * factor90).toFixed(2);
      }
    }
  }

  // 12c. Hdrs A/90, Fls Made/90, Tck C/90
  if (!hasValue('Hdrs A/90') && getV('Hdrs A') !== null) {
    player['Hdrs A/90'] = (getN('Hdrs A') * factor90).toFixed(2);
  }
  if (!hasValue('Fls Made/90') && getV('Fls') !== null) {
    player['Fls Made/90'] = (getN('Fls') * factor90).toFixed(2);
  }
  if (!hasValue('Tck C/90') && getV('Tck C') !== null) {
    player['Tck C/90'] = (getN('Tck C') * factor90).toFixed(2);
  }

  // 13. Pr Pass Yield %
  // Percentage of Progressive Passes out of all pass attempts
  // Measures the "productivity" of each pass attempt in terms of progression
  if (!hasValue('Pr Pass Yield %')) {
    const prPasses = getV('Pr Passes');
    let pasA = getV('Pas A');
    // Fallback for Pas A
    if (pasA === null) pasA = getV('Ps A');
    if (pasA === null) pasA = getV('Passes Attempted');
    // Logical guard: Pr Passes <= Pas A (progressive passes cannot exceed all pass attempts)
    if (pasA !== null && pasA > 0 && prPasses !== null && prPasses <= pasA) {
      const percentage = (prPasses / pasA) * 100;
      // Validation: the percentage must be within 0-100%
      if (percentage >= 0 && percentage <= 100) {
        player['Pr Pass Yield %'] = percentage.toFixed(2);
      }
    }
  }

  // 14. Interceptions/90, Blocks/90, Clearances/90
  if (!hasValue('Int/90') && getV('Itc') !== null)
    player['Int/90'] = (getV('Itc') * factor90).toFixed(2);
  if (!hasValue('Blk/90') && getV('Blk') !== null)
    player['Blk/90'] = (getV('Blk') * factor90).toFixed(2);
  if (!hasValue('Clr/90') && getV('Clr') !== null)
    player['Clr/90'] = (getV('Clr') * factor90).toFixed(2);

  // 15. Tck W % (Tackle Completion %) = (Tck C / Tck A) * 100
  if (!hasValue('Tck W %')) {
    const tckC = getV('Tck C');
    let tckA = getV('Tck A');
    if (tckA === null) tckA = getV('Tackles Attempted');
    // Logical guard: Tck C <= Tck A
    if (tckC !== null && tckA !== null && tckA > 0 && tckC <= tckA) {
      const percentage = (tckC / tckA) * 100;
      // Validation: the percentage must be within 0-100%
      if (percentage >= 0 && percentage <= 100) {
        player['Tck W %'] = percentage.toFixed(2);
      }
    }
  }
  // Tck W/90 (Tackles Won per 90) = Tck C * factor90
  // Tck C = Tackles Completed = Tackles Won
  if (!hasValue('Tck W/90')) {
    let tckC = getV('Tck C');
    if (tckC === null) tckC = getV('Tackles Completed');
    if (tckC !== null) player['Tck W/90'] = (tckC * factor90).toFixed(2);
  }

  // Key Headers/90 (K Hdrs/90)
  if (!hasValue('K Hdrs/90')) {
    let kHdrs = getV('K Hdrs');
    if (kHdrs === null) kHdrs = getV('Key Headers');
    if (kHdrs !== null) player['K Hdrs/90'] = (kHdrs * factor90).toFixed(2);
  }

  // Key Tackles/90 (K Tck/90): use the value directly from the file (it is already per 90 minutes)
  if (!hasValue('K Tck/90')) {
    let kTck90 = getV('K Tck/90');
    if (kTck90 === null) kTck90 = getV('Key Tackles/90');
    if (kTck90 !== null) {
      player['K Tck/90'] = kTck90.toFixed(2);
    }
  }

  if (useSettingsStore.getState().settings.pAdjEnabled) {
    applyPAdjDerivations({ defaultPossession, getTeamPossession, hasValue, player });
  }

  applyAttackingDerivations({ factor90, getN, getV, hasValue, isRawEmpty, mins, player });

  applyTailDerivations({ factor90, getN, getV, hasValue, mins, player });
}
