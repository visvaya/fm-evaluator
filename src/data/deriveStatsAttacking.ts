/* eslint-disable sonarjs/cognitive-complexity, sonarjs/max-lines-per-function */
import { useSettingsStore } from '../store/useSettingsStore';
export interface AttackingDerivationArgs {
  factor90: number;
  getN: (key: string) => any;
  getV: (key: string) => any;
  hasValue: (key: string) => boolean;
  isRawEmpty: (key: string) => boolean;
  mins: number;
  player: Record<string, any>;
}
export function applyAttackingDerivations({
  factor90,
  getN,
  getV,
  hasValue,
  isRawEmpty,
  mins,
  player
}: AttackingDerivationArgs) {
  // 16. Cr C % (Crosses Completed / Attempted)
  if (!hasValue('Cr C %')) {
    // First check if pre-calculated value exists in file (Cr C/A)
    let crCPercent = getV('Cr C/A');
    if (crCPercent !== null) {
      // Convert to percentage if needed (might already be percentage)
      if (crCPercent <= 1) crCPercent = crCPercent * 100;
      if (crCPercent >= 0 && crCPercent <= 100) {
        player['Cr C %'] = crCPercent.toFixed(2);
      }
    } else if (getV('Cr C') !== null && getV('Cr A') !== null) {
      // Calculate from Cr C and Cr A
      const crC = getV('Cr C');
      const crA = getV('Cr A');
      // Logical guard: Cr C <= Cr A
      if (crA > 0 && crC !== null && crC <= crA) {
        const percentage = (crC / crA) * 100;
        // Validation: the percentage must be within 0-100%
        if (percentage >= 0 && percentage <= 100) {
          player['Cr C %'] = percentage.toFixed(2);
        }
      }
    }
  }

  // --- NEW STATS FROM DOC ---
  // NP-xG/Shot
  // Precise version: uses Pens (Taken) or derives it from Pens S + Pen/R
  if (!hasValue('NP-xG/Shot')) {
    const totalShotsRaw = getV('Shots');
    const totalXG = getV('xG');

    if (totalShotsRaw !== null && totalXG !== null) {
      // STEP 1: Determine the number of penalty attempts (Attempts)
      let penAttempts = 0;

      // Read the direct values
      const pensTaken = getV('Pens'); // Penalties Taken
      const pensScored = getV('Pens S'); // Penalties Scored

      if (pensTaken !== null && pensTaken > 0) {
        // Ideal case: the "Pens" (Taken) column is present
        penAttempts = pensTaken;
      } else if (pensScored !== null && pensScored > 0) {
        // Fallback: only goals and conversion rate are available
        let penRatio = getV('Pen R'); // e.g. 100%, 0.5 etc.

        if (penRatio === null || penRatio === 0) {
          penAttempts = pensScored; // Assume 100% conversion when data is missing
        } else {
          if (penRatio > 1) penRatio = penRatio / 100; // Convert 100 -> 1.0
          penAttempts = Math.round(pensScored / penRatio);
        }
      }

      // GUARD: penalty attempts cannot exceed total shots
      // (Protects against FM data errors, e.g. when Shots did not count a penalty)
      penAttempts = Math.min(penAttempts, totalShotsRaw);

      // STEP 2: Compute NP-xG (non-penalty xG)
      // Subtract penaltyXGFactor xG for each penalty attempt
      const penaltyFactor = useSettingsStore.getState().settings.penaltyXGFactor || 0.76;
      const npxG = Math.max(0, totalXG - penaltyFactor * penAttempts);

      // STEP 3: Compute NP-Shots (non-penalty shots)
      // Subtract penalty attempts from total shots
      // Minimum 1 to avoid division by 0, but if totalShotsRaw - penAttempts <= 0, no value is computed
      const npShots = Math.max(1, totalShotsRaw - penAttempts);

      // STEP 4: Result
      // If the player took non-penalty shots, divide non-penalty xG by non-penalty shots
      if (npShots > 0 && totalShotsRaw - penAttempts > 0) {
        const result = npxG / npShots;
        // Validate the final result: make sure it is not negative
        if (result >= 0) {
          player['NP-xG/Shot'] = result.toFixed(2);
        }
      }
    }
  }

  // Conversion % (Goals / Shots) - previously called "Shot %"
  // Group 1: Skill/Role Specific - requires base value (Gls or Shots)
  if (!hasValue('Conv %')) {
    // Check if BOTH raw Gls and Shots values are empty ('-' or 0) - inactivity penalty
    if (isRawEmpty('Gls') && isRawEmpty('Shots')) {
      player['Conv %'] = null; // Penalty: no base activity
    } else {
      const gls = getV('Gls');
      const shots = getV('Shots');
      // Logical guard: Shots >= Gls (a player cannot score more goals than shots taken)
      if (gls !== null && shots !== null && shots > 0 && shots >= gls) {
        const percentage = (gls / shots) * 100;
        // Validation: the percentage must be within 0-100%
        if (percentage >= 0 && percentage <= 100) {
          player['Conv %'] = percentage.toFixed(2);
        }
      }
    }
  }

  // Gls In Box % ((Gls - Goals Outside Box) / Gls) * 100
  if (!hasValue('Gls In Box %')) {
    const goalsTotal = getV('Gls');
    let goalsOutside = getV('Gls Out');

    // If Gls Out is missing, check for Goals Outside Box/90
    if (goalsOutside === null) {
      let goalsOutside90 = getV('Goals Outside Box/90');
      if (goalsOutside90 === null) goalsOutside90 = getV('Gls Out/90');
      if (goalsOutside90 !== null && mins > 0) {
        // STEP 1: Rebuild the number of goals from outside the box from the "per 90" value
        const rawGoalsOutside = (goalsOutside90 * mins) / 90;
        // STEP 2: Round to an integer, because goals are discrete
        goalsOutside = Math.round(rawGoalsOutside);
      }
    }

    if (goalsTotal !== null && goalsOutside !== null && goalsTotal > 0) {
      // STEP 3: Goals from outside the box cannot exceed total goals
      goalsOutside = Math.min(goalsOutside, goalsTotal);

      const goalsInside = goalsTotal - goalsOutside;

      // Logical guard: goalsInside cannot be negative
      if (goalsInside >= 0) {
        const percentage = (goalsInside / goalsTotal) * 100;

        // Validation: the percentage must be within 0-100%
        if (percentage >= 0 && percentage <= 100) {
          player['Gls In Box %'] = percentage.toFixed(2);
        }
      }
    }
  }

  // In Box Conv % (goalsInside / shotsInside) * 100
  if (!hasValue('In Box Conv %')) {
    // 1. Compute the number of goals inside the box
    const goalsTotal = getV('Gls');
    let goalsOutside = getV('Gls Out');

    // If Gls Out is missing, check for Goals Outside Box/90
    if (goalsOutside === null) {
      let goalsOutside90 = getV('Goals Outside Box/90');
      if (goalsOutside90 === null) goalsOutside90 = getV('Gls Out/90');
      if (goalsOutside90 !== null && mins > 0) {
        // STEP 1: Rebuild the number of goals from outside the box from the "per 90" value
        const rawGoalsOutside = (goalsOutside90 * mins) / 90;
        // STEP 2: Round to an integer, because goals are discrete
        goalsOutside = Math.round(rawGoalsOutside);
      }
    }

    if (goalsTotal !== null && goalsOutside !== null) {
      // STEP 3: Goals from outside the box cannot exceed total goals
      goalsOutside = Math.min(goalsOutside, goalsTotal);
      const goalsInside = goalsTotal - goalsOutside;

      // Validation: goalsInside cannot be negative
      if (goalsInside >= 0) {
        // 2. Compute the number of shots from outside the box (convert /90 to an integer)
        let shotsOutside90 = getV('Shots Outside Box/90');
        if (shotsOutside90 === null) shotsOutside90 = getV('Shts Out/90');
        const shotsTotal = getV('Shots');

        if (shotsOutside90 !== null && mins > 0 && shotsTotal !== null && shotsTotal > 0) {
          // STEP 1: Rebuild from the per-90 value
          const rawShotsOutside = (shotsOutside90 * mins) / 90;
          // STEP 2: Round to an integer
          let shotsOutside = Math.round(rawShotsOutside);
          // STEP 3: Guard (do not exceed the maximum)
          shotsOutside = Math.min(shotsOutside, shotsTotal);

          // 3. Compute the number of shots inside the box
          const shotsInside = shotsTotal - shotsOutside;

          // 4. Validation and result in % (guards against division by 0 and negative values)
          if (
            shotsInside > 0 &&
            shotsInside <= shotsTotal && // LOGICAL GUARD: shots inside the box cannot be fewer than goals inside the box
            // shotsInside < goalsInside means a data error (e.g. penalties counted as goals but not as shots)
            shotsInside >= goalsInside
          ) {
            const percentage = (goalsInside / shotsInside) * 100;

            // Validation: the percentage must be within 0-100%
            // 100% = the player scored from every shot inside the box (logical maximum)
            if (percentage >= 0 && percentage <= 100) {
              player['In Box Conv %'] = percentage.toFixed(2);
            }
            // If the result is outside 0-100%, no value is stored (it stays null)
          }
          // If shotsInside < goalsInside, no value is stored (data error)
        }
      }
    }
  }

  // ShT % (Shots on Target / Shots)
  if (!hasValue('ShT %') && getV('ShT') !== null && getV('Shots') !== null) {
    const shots = getV('Shots');
    const shT = getV('ShT');
    // Logical guard: ShT <= Shots
    if (shots > 0 && shT !== null && shT <= shots) {
      const percentage = (shT / shots) * 100;
      // Validation: the percentage must be within 0-100%
      if (percentage >= 0 && percentage <= 100) {
        player['ShT %'] = percentage.toFixed(2);
      }
    }
  }

  // Shts In % ((Shots - shotsOutside) / Shots) * 100
  if (!hasValue('Shts In %')) {
    let shotsOutside90 = getV('Shots Outside Box/90');
    if (shotsOutside90 === null) shotsOutside90 = getV('Shts Out/90');
    const shotsTotal = getV('Shots');
    if (shotsOutside90 !== null && mins > 0 && shotsTotal !== null && shotsTotal > 0) {
      // STEP 1: Rebuild from the per-90 value
      const rawShotsOutside = (shotsOutside90 * mins) / 90;
      // STEP 2: Round to an integer
      let shotsOutside = Math.round(rawShotsOutside);
      // STEP 3: Guard (do not exceed the maximum)
      shotsOutside = Math.min(shotsOutside, shotsTotal);

      // Compute shots inside the box
      const shotsInside = shotsTotal - shotsOutside;

      // Logical guard: shotsInside cannot be negative
      if (shotsInside >= 0 && shotsInside <= shotsTotal) {
        const percentage = (shotsInside / shotsTotal) * 100;

        // Validation: the percentage must be within 0-100%
        if (percentage >= 0 && percentage <= 100) {
          player['Shts In %'] = percentage.toFixed(2);
        }
      }
    }
  }

  // Shts Out % (Shts Out / Shots)
  if (!hasValue('Shts Out %') && getV('Shts Out') !== null && getV('Shots') !== null) {
    const shots = getV('Shots');
    const shtsOut = getV('Shts Out');
    // Logical guard: Shts Out <= Shots
    if (shots > 0 && shtsOut !== null && shtsOut <= shots) {
      const percentage = (shtsOut / shots) * 100;
      // Validation: the percentage must be within 0-100%
      if (percentage >= 0 && percentage <= 100) {
        player['Shts Out %'] = percentage.toFixed(2);
      }
    }
  }

  // Additional stats needed for STATS_CONFIG
  // xGP/90 (Expected Goals Prevented per 90) - for GK
  // Group 1: Skill/Role Specific - requires base value
  // xGP is a difference (it can be negative, positive or zero), but only when there were shots
  if (!hasValue('xGP/90')) {
    // Check for shots: Svh+Svt+Svp = 0 means no shots faced
    const svh = getN('Svh');
    const svt = getN('Svt');
    const svp = getN('Svp');
    const totalSaves = svh + svt + svp;
    const hasShots = totalSaves > 0;

    if (hasShots) {
      // There were shots: check the xGP value
      const xGP = getV('xGP');
      if (xGP !== null) {
        player['xGP/90'] = (xGP * factor90).toFixed(2);
      } else if (isRawEmpty('xGP')) {
        // The source value is empty/null but there were shots: it may be null (no data)
        player['xGP/90'] = null;
      }
    } else {
      // No shots: xGP cannot have a value
      player['xGP/90'] = null;
    }
  }

  // Aer A/90 (Aerial Challenges Attempted/90)
  // Note: the source data has no 'Aer A', only 'Aer A/90' (which in practice is Hdrs A/90)
  // Computed from Hdrs A, the same way as Hdrs A/90
  if (!hasValue('Aer A/90') && getV('Hdrs A') !== null) {
    player['Aer A/90'] = (getN('Hdrs A') * factor90).toFixed(2);
  }

  // Pas A/90 (Passes Attempted/90)
  if (!hasValue('Pas A/90')) {
    if (getV('Pas A') !== null) {
      player['Pas A/90'] = (getV('Pas A') * factor90).toFixed(2);
    } else if (getV('Ps A') !== null) {
      player['Pas A/90'] = (getV('Ps A') * factor90).toFixed(2);
    }
  }

  // xA/90
  if (!hasValue('xA/90') && getV('xA') !== null) {
    player['xA/90'] = (getV('xA') * factor90).toFixed(2);
  }

  // OP-KP/90 (Open Play Key Passes/90)
  if (!hasValue('OP-KP/90') && getV('OP-KP') !== null) {
    player['OP-KP/90'] = (getV('OP-KP') * factor90).toFixed(2);
  }

  // OP-Crs A/90 (Open Play Crosses Attempted/90)
  if (!hasValue('OP-Crs A/90') && getV('OP-Crs A') !== null) {
    player['OP-Crs A/90'] = (getV('OP-Crs A') * factor90).toFixed(2);
  }

  // Pas % (Pass Completion %)
  if (!hasValue('Pas %')) {
    const pasC = getV('Pas C');
    let pasA = getV('Pas A');
    if (pasA === null) pasA = getV('Ps A');
    // Logical guard: Pas C <= Pas A
    if (pasC !== null && pasA !== null && pasA > 0 && pasC <= pasA) {
      const percentage = (pasC / pasA) * 100;
      // Validation: the percentage must be within 0-100%
      if (percentage >= 0 && percentage <= 100) {
        player['Pas %'] = percentage.toFixed(2);
      }
    }
  }

  // Hdr % (Headers Won %)
  if (!hasValue('Hdr %') && getV('Hdrs') !== null && getV('Hdrs A') !== null) {
    const hdrs = getV('Hdrs'); // Hdrs = Headers Won
    const hdrsA = getV('Hdrs A');
    // Logical guard: Hdrs <= Hdrs A
    if (hdrsA > 0 && hdrs !== null && hdrs <= hdrsA) {
      const percentage = (hdrs / hdrsA) * 100;
      // Validation: the percentage must be within 0-100%
      if (percentage >= 0 && percentage <= 100) {
        player['Hdr %'] = percentage.toFixed(2);
      }
    }
  }

  // Pres A/90 (Pressures Attempted/90)
  if (!hasValue('Pres A/90') && getV('Pres A') !== null) {
    player['Pres A/90'] = (getV('Pres A') * factor90).toFixed(2);
  }
}
