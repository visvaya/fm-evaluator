/* eslint-disable @typescript-eslint/naming-convention, sonarjs/cognitive-complexity, sonarjs/max-lines-per-function */
import { useSettingsStore } from '../store/useSettingsStore';

export interface TailDerivationArgs {
  factor90: number;
  getN: (key: string) => any;
  getV: (key: string) => any;
  hasValue: (key: string) => boolean;
  mins: number;
  player: Record<string, any>;
}

export function applyTailDerivations({
  factor90,
  getN,
  getV,
  hasValue,
  mins,
  player
}: TailDerivationArgs) {
  // --- NEW STATISTICS FROM FM DATA LAB ---

  // Goal Contributions
  if (!hasValue('Goal Contributions')) {
    const gls = getN('Gls');
    const assists = getN('Assists');
    if (gls !== null || assists !== null) {
      const total = (gls || 0) + (assists || 0);
      player['Goal Contributions'] = total.toFixed(0);
    }
  }
  if (!hasValue('Goal Contributions/90')) {
    const gc = getV('Goal Contributions');
    if (gc !== null) {
      const gcNum = typeof gc === 'string' ? parseFloat(gc) : gc;
      if (!isNaN(gcNum)) {
        player['Goal Contributions/90'] = (gcNum * factor90).toFixed(2);
      }
    }
  }

  // xGC (Expected Goal Contributions)
  if (!hasValue('xGC')) {
    const xG = getV('xG');
    const xA = getV('xA');
    if (xG !== null || xA !== null) {
      const total = (xG || 0) + (xA || 0);
      player.xGC = total.toFixed(2);
    }
  }
  if (!hasValue('xGC/90')) {
    const xgc = getV('xGC');
    if (xgc !== null) {
      const xgcNum = typeof xgc === 'string' ? parseFloat(xgc) : xgc;
      if (!isNaN(xgcNum)) {
        player['xGC/90'] = (xgcNum * factor90).toFixed(2);
      }
    }
  }

  // Non-pen Goal Contributions
  if (!hasValue('Non-pen Goal Contributions')) {
    const npGls = getN('Gls') - getN('Pens S');
    const assists = getN('Assists');
    if (npGls >= 0 || assists !== null) {
      const total = Math.max(0, npGls) + (assists || 0);
      player['Non-pen Goal Contributions'] = total.toFixed(0);
    }
  }
  if (!hasValue('Non-pen Goal Contributions/90')) {
    const npGC = getV('Non-pen Goal Contributions');
    if (npGC !== null) {
      const npGCNum = typeof npGC === 'string' ? parseFloat(npGC) : npGC;
      if (!isNaN(npGCNum)) {
        player['Non-pen Goal Contributions/90'] = (npGCNum * factor90).toFixed(2);
      }
    }
  }

  // Non-pen xGC
  if (!hasValue('Non-pen xGC')) {
    let np_xG_val = null;
    const np_xG = getV('NP-xG');
    const penaltyFactor = useSettingsStore.getState().settings.penaltyXGFactor || 0.76;
    if (np_xG === null && getV('xG') !== null) {
      np_xG_val = Math.max(0, getN('xG') - penaltyFactor * getN('Pens'));
    } else if (np_xG !== null) {
      np_xG_val = Math.max(0, np_xG);
    }
    const xA = getV('xA');
    if (np_xG_val !== null || xA !== null) {
      const total = (np_xG_val || 0) + (xA || 0);
      player['Non-pen xGC'] = total.toFixed(2);
    }
  }
  if (!hasValue('Non-pen xGC/90')) {
    const npxGC = getV('Non-pen xGC');
    if (npxGC !== null) {
      const npxGCNum = typeof npxGC === 'string' ? parseFloat(npxGC) : npxGC;
      if (!isNaN(npxGCNum)) {
        player['Non-pen xGC/90'] = (npxGCNum * factor90).toFixed(2);
      }
    }
  }

  // xG/Shot
  if (!hasValue('xG/Shot') && getV('xG') !== null && getV('Shots') !== null) {
    const xG = getV('xG');
    const shots = getV('Shots');
    if (shots > 0) {
      const result = xG / shots;
      if (result >= 0) {
        player['xG/Shot'] = result.toFixed(2);
      }
    }
  }

  // Minutes/Non-pen Goal
  if (!hasValue('Minutes/Non-pen Goal')) {
    const npGls = getN('Gls') - getN('Pens S');
    if (npGls >= 1 && mins >= 1) {
      player['Minutes/Non-pen Goal'] = (mins / npGls).toFixed(1);
    }
  }

  // Minutes/Assist
  if (!hasValue('Minutes/Assist')) {
    const assists = getN('Assists');
    if (assists !== null && assists >= 1 && mins >= 1) {
      player['Minutes/Assist'] = (mins / assists).toFixed(1);
    }
  }

  // Assists/Clear Cut Chances Created
  if (!hasValue('Assists/Clear Cut Chances Created')) {
    const assists = getN('Assists');
    const ccc = getN('CCC');
    if (ccc !== null && assists !== null && ccc >= 5 && assists >= 1 && ccc > 0) {
      const result = assists / ccc;
      if (result >= 0) {
        player['Assists/Clear Cut Chances Created'] = result.toFixed(2);
      }
    }
  }

  // Offsides/90
  if (!hasValue('Offsides/90')) {
    const off = getN('Off');
    if (off !== null) {
      player['Offsides/90'] = (off * factor90).toFixed(2);
    }
  }

  // Offside/Non-pen Goals
  if (!hasValue('Offside/Non-pen Goals')) {
    const npGls = getN('Gls') - getN('Pens S');
    if (npGls >= 1) {
      const offsides = getN('Off');
      if (offsides !== null && offsides >= 0) {
        player['Offside/Non-pen Goals'] = (offsides / npGls).toFixed(2);
      }
    }
  }

  // Offside/Non-pen xG
  if (!hasValue('Offside/Non-pen xG')) {
    let np_xG = getV('NP-xG');
    const penaltyFactor = useSettingsStore.getState().settings.penaltyXGFactor || 0.76;
    if (np_xG === null && getV('xG') !== null) {
      np_xG = Math.max(0, getN('xG') - penaltyFactor * getN('Pens'));
    } else if (np_xG !== null) {
      np_xG = Math.max(0, np_xG);
    }
    if (np_xG !== null && np_xG >= 1) {
      const offsides = getN('Off');
      if (offsides !== null && offsides >= 0) {
        player['Offside/Non-pen xG'] = (offsides / np_xG).toFixed(2);
      }
    }
  }

  // Poss+/- %
  if (!hasValue('Poss+/- %')) {
    let possWon = getN('Poss Won/90');
    if (possWon === null) possWon = getN('Possession Won/90');
    if (possWon === null) possWon = getN('Poss Won');
    let possLost = getN('Poss Lost/90');
    if (possLost === null) possLost = getN('Possession Lost/90');
    if (possLost === null) possLost = getN('Poss Lost');

    if (possWon !== null && possLost !== null) {
      const total = possWon + possLost;
      if (total > 0) {
        const percentage = (possWon / total) * 100;
        if (percentage >= 0 && percentage <= 100) {
          player['Poss+/- %'] = percentage.toFixed(2);
        }
      }
    }
  }

  // Headers Lost
  if (!hasValue('Headers Lost')) {
    const hdrsA = getN('Hdrs A');
    const hdrs = getN('Hdrs');
    if (hdrsA !== null && hdrs !== null && hdrsA >= hdrs) {
      player['Headers Lost'] = (hdrsA - hdrs).toFixed(0);
    }
  }

  // Headers Lost/90
  if (!hasValue('Headers Lost/90')) {
    const hdrsL90 = getV('Hdrs L/90');
    if (hdrsL90 === null) {
      const hdrsLost = getV('Headers Lost');
      if (hdrsLost !== null) {
        player['Headers Lost/90'] = (hdrsLost * factor90).toFixed(2);
      }
    } else {
      player['Headers Lost/90'] = hdrsL90.toFixed(2);
    }
  }

  // Headers Lost %
  if (!hasValue('Headers Lost %')) {
    const hdrsA = getN('Hdrs A');
    const hdrsLost = getV('Headers Lost');
    if (hdrsA !== null && hdrsA > 0 && hdrsLost !== null && hdrsLost >= 0 && hdrsLost <= hdrsA) {
      const percentage = (hdrsLost / hdrsA) * 100;
      if (percentage >= 0 && percentage <= 100) {
        player['Headers Lost %'] = percentage.toFixed(2);
      }
    }
  }

  // Key Headers %
  if (!hasValue('Key Headers %')) {
    const kHdrs = getN('K Hdrs');
    const hdrsA = getN('Hdrs A');
    if (hdrsA !== null && hdrsA > 0 && kHdrs !== null && kHdrs >= 0 && kHdrs <= hdrsA) {
      const percentage = (kHdrs / hdrsA) * 100;
      if (percentage >= 0 && percentage <= 100) {
        player['Key Headers %'] = percentage.toFixed(2);
      }
    }
  }

  // Key Tackles %
  if (!hasValue('Key Tackles %')) {
    const kTck = getN('K Tck');
    let tckA = getV('Tck A');
    if (tckA === null) tckA = getV('Tackles Attempted');
    if (tckA === null) tckA = 0;
    if (tckA !== null && tckA > 0 && kTck !== null && kTck >= 0 && kTck <= tckA) {
      const percentage = (kTck / tckA) * 100;
      if (percentage >= 0 && percentage <= 100) {
        player['Key Tackles %'] = percentage.toFixed(2);
      }
    }
  }

  // --- GOALKEEPER STATISTICS ---

  // Saves Held Ratio
  if (!hasValue('Saves Held Ratio')) {
    const svh = getN('Svh');
    const svt = getN('Svt');
    const svp = getN('Svp');
    const totalSaves = svh + svt + svp;
    if (totalSaves > 0) {
      const ratio = (svh / totalSaves) * 100;
      if (ratio >= 0 && ratio <= 100) {
        player['Saves Held Ratio'] = ratio.toFixed(2);
      }
    }
  }

  // Saves Held/Shots Faced Ratio
  if (!hasValue('Saves Held/Shots Faced Ratio')) {
    const svh = getN('Svh');
    const svt = getN('Svt');
    const svp = getN('Svp');
    const conc = getN('Conc');
    const shotsOnTargetAgainst = svh + svt + svp + conc;
    if (shotsOnTargetAgainst > 0) {
      const ratio = (svh / shotsOnTargetAgainst) * 100;
      if (ratio >= 0 && ratio <= 100) {
        player['Saves Held/Shots Faced Ratio'] = ratio.toFixed(2);
      }
    }
  }

  // Saves Tipped Ratio
  if (!hasValue('Saves Tipped Ratio')) {
    const svh = getN('Svh');
    const svt = getN('Svt');
    const svp = getN('Svp');
    const totalSaves = svh + svt + svp;
    if (totalSaves > 0) {
      const ratio = (svt / totalSaves) * 100;
      if (ratio >= 0 && ratio <= 100) {
        player['Saves Tipped Ratio'] = ratio.toFixed(2);
      }
    }
  }

  // Saves Tipped/Shots Faced Ratio
  if (!hasValue('Saves Tipped/Shots Faced Ratio')) {
    const svh = getN('Svh');
    const svt = getN('Svt');
    const svp = getN('Svp');
    const conc = getN('Conc');
    const shotsOnTargetAgainst = svh + svt + svp + conc;
    if (shotsOnTargetAgainst > 0) {
      const ratio = (svt / shotsOnTargetAgainst) * 100;
      if (ratio >= 0 && ratio <= 100) {
        player['Saves Tipped/Shots Faced Ratio'] = ratio.toFixed(2);
      }
    }
  }

  // Saves Parried Ratio
  if (!hasValue('Saves Parried Ratio')) {
    const svh = getN('Svh');
    const svt = getN('Svt');
    const svp = getN('Svp');
    const totalSaves = svh + svt + svp;
    if (totalSaves > 0) {
      const ratio = (svp / totalSaves) * 100;
      if (ratio >= 0 && ratio <= 100) {
        player['Saves Parried Ratio'] = ratio.toFixed(2);
      }
    }
  }

  // Saves Parried/Shots Faced Ratio
  if (!hasValue('Saves Parried/Shots Faced Ratio')) {
    const svh = getN('Svh');
    const svt = getN('Svt');
    const svp = getN('Svp');
    const conc = getN('Conc');
    const shotsOnTargetAgainst = svh + svt + svp + conc;
    if (shotsOnTargetAgainst > 0) {
      const ratio = (svp / shotsOnTargetAgainst) * 100;
      if (ratio >= 0 && ratio <= 100) {
        player['Saves Parried/Shots Faced Ratio'] = ratio.toFixed(2);
      }
    }
  }

  // Saves/Goal Conceded
  if (!hasValue('Saves/Goal Conceded')) {
    const svh = getN('Svh');
    const svt = getN('Svt');
    const svp = getN('Svp');
    const totalSaves = svh + svt + svp;
    const conc = getN('Conc');
    if (conc > 0 && totalSaves >= 0) {
      const ratio = totalSaves / conc;
      if (ratio >= 0) {
        player['Saves/Goal Conceded'] = ratio.toFixed(2);
      }
    }
  }

  // Clean Sheet Ratio
  if (!hasValue('Clean Sheet Ratio')) {
    const cleanSheets = getN('Clean Sheets');
    if (cleanSheets !== null && mins > 0) {
      const approxMatches = Math.max(1, Math.round(mins / 90));
      if (approxMatches > 0 && cleanSheets >= 0 && cleanSheets <= approxMatches) {
        const ratio = (cleanSheets / approxMatches) * 100;
        if (ratio >= 0 && ratio <= 100) {
          player['Clean Sheet Ratio'] = ratio.toFixed(2);
        }
      }
    }
  }

  // --- CARD STATISTICS ---

  // Yellows/Tackle
  if (!hasValue('Yellows/Tackle')) {
    let tckA = getV('Tck A');
    if (tckA === null) tckA = getV('Tackles Attempted');
    if (tckA !== null && tckA > 0) {
      const yel = getN('Yel') || 0;
      const ratio = yel / tckA;
      if (ratio >= 0) {
        player['Yellows/Tackle'] = ratio.toFixed(3);
      }
    }
  }

  // Reds/Tackle
  if (!hasValue('Reds/Tackle')) {
    let tckA = getV('Tck A');
    if (tckA === null) tckA = getV('Tackles Attempted');
    if (tckA !== null && tckA > 0) {
      const red = getN('Red') || 0;
      const ratio = red / tckA;
      if (ratio >= 0) {
        player['Reds/Tackle'] = ratio.toFixed(3);
      }
    }
  }

  // Yellows/90
  if (!hasValue('Yellows/90')) {
    const yel = getN('Yel');
    if (yel !== null) {
      player['Yellows/90'] = (yel * factor90).toFixed(2);
    }
  }

  // Reds/90
  if (!hasValue('Reds/90')) {
    const red = getN('Red');
    if (red !== null) {
      player['Reds/90'] = (red * factor90).toFixed(2);
    }
  }
}
