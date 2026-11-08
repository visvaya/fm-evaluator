export interface GoalkeepingDerivationArgs {
  factor90: number;
  getN: (key: string) => any;
  getV: (key: string) => any;
  hasValue: (key: string) => boolean;
  mins: number;
  player: Record<string, any>;
}
export function applyGoalkeepingDerivations({
  factor90,
  getN,
  getV,
  hasValue,
  mins,
  player
}: GoalkeepingDerivationArgs) {
  // --- GOALKEEPING STATS RECONSTRUCTION ---
  // Instead of fixing broken values from the file, rebuild them entirely from the raw data

  // 1. Rebuild saves and shots faced
  const svt = getN('Svt');
  const svp = getN('Svp');
  const svh = getN('Svh');
  const totalSaves = svt + svp + svh;

  const conc = getN('Conc');
  // Shots Faced = saves + goals conceded
  const shotsFaced = totalSaves + conc;

  // 2. NewSaves/90 (computed as (Svh + Svt + Svp) * factor90; overrides the file's 'Saves/90' with a precise value)
  // The file rounds these values to integers (e.g. 1 or 2), which is imprecise.
  if (mins > 0 && totalSaves >= 0) {
    player['Saves/90'] = (totalSaves * factor90).toFixed(2); // Stored as 'Saves/90' for compatibility
  }

  // 3. NewSv % (computed as (Svt + Svp + Svh) / ((Svt + Svp + Svh) + Conc) * 100%; overrides the file's 'Sv %')
  // Formula: NewSv % = totalSaves / shotsFaced * 100, where shotsFaced = totalSaves + Conc
  if (shotsFaced > 0) {
    const calculatedSvPct = (totalSaves / shotsFaced) * 100;
    player['Sv %'] = calculatedSvPct.toFixed(1); // Stored as 'Sv %' for compatibility, e.g. 77.4%
  } else {
    player['Sv %'] = '0.0';
  }

  // 4. xSv % (computed from xGP)
  // Formula: Expected Save % = (Expected Saves / Shots Faced) * 100
  // Rebuild xG Against: xG = Conc + xGP (because xGP = xG - Conc)
  // Expected Saves = Shots Faced - xG

  const xgpVal = getV('xGP');

  if (xgpVal !== null && shotsFaced > 0) {
    // Rebuild the xG the goalkeeper faced
    const reconstructedXG = conc + xgpVal;

    // Compute the expected save rate
    // If xG was 12.37 from 31 shots, then xSv% = (31 - 12.37) / 31 * 100
    const expectedSaves = shotsFaced - reconstructedXG;
    const calculatedXSvPct = (expectedSaves / shotsFaced) * 100;

    player['xSv %'] = calculatedXSvPct.toFixed(1);
  }
  // Without xGP, xSv % stays null (no data to compute it from)

  // 5. Save Efficiency (weighted save quality)
  // Unchanged, because it is based on raw data
  if (!hasValue('Save Efficiency') && totalSaves > 0) {
    const weightedScore = svh * 3 + svt * 2 + svp * 1;
    player['Save Efficiency'] = (weightedScore / totalSaves).toFixed(2);
  }
}
