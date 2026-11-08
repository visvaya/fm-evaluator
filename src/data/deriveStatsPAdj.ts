/* eslint-disable sonarjs/no-nested-conditional */
import { useSettingsStore } from '../store/useSettingsStore';
export interface PAdjDerivationArgs {
  defaultPossession: number;
  getTeamPossession: (clubName: unknown) => number | null;
  hasValue: (key: string) => boolean;
  player: Record<string, any>;
}
export function applyPAdjDerivations({
  defaultPossession,
  getTeamPossession,
  hasValue,
  player
}: PAdjDerivationArgs) {
  // --- PAdj Logic Start ---
  // Possession-adjusted defensive stats (as in FM Data Lab)
  // PAdj_Stat = Stat_90 * 50 / (100 - AvgPossession)
  // where AvgPossession is the team's average possession in %.
  const rawClubName = player.Club || player.club || player.club || '';
  const possessionFromMap = getTeamPossession(rawClubName);
  // Fallback: store defaultPossession -> defaultPossession param -> 50
  const storedDefaultPossession = useSettingsStore.getState().settings.defaultPossession;
  let basePossession =
    possessionFromMap !== null && possessionFromMap !== undefined
      ? possessionFromMap
      : typeof storedDefaultPossession === 'number'
        ? storedDefaultPossession
        : (defaultPossession ?? 50);

  if (isNaN(basePossession)) {
    basePossession = 50;
  }

  // Clamp to a safe range to avoid division by 0
  const possessionClamped = Math.max(0, Math.min(95, basePossession));
  let timeInDefense = 100 - possessionClamped;
  // Minimum time in defense, to avoid extreme multipliers
  timeInDefense = Math.max(timeInDefense, 5);

  const padjFactor = 50 / timeInDefense;

  // Per-90 stats to adjust
  const padjTargets = [
    { dest: 'PAdj Tck A', src: 'Tck A/90' }, // Tackles Attempted
    { dest: 'PAdj Int', src: 'Int/90' }, // Interceptions
    { dest: 'PAdj Clr', src: 'Clr/90' }, // Clearances
    { dest: 'PAdj Blk', src: 'Blk/90' }, // Blocks
    { dest: 'PAdj Pres A', src: 'Pres A/90' } // Pressures Attempted
  ];

  padjTargets.forEach((stat) => {
    // Do not overwrite a value that already exists (e.g. from the file)
    if (hasValue(stat.dest)) return;
    const rawVal = parseFloat(player[stat.src]);
    player[stat.dest] = isNaN(rawVal) ? null : (rawVal * padjFactor).toFixed(2);
  });

  // Keep the possession used as auxiliary information (integer %)
  if (!hasValue('Team Poss')) {
    const possNumber = Number(basePossession);
    const formatted = isNaN(possNumber) ? '' : possNumber.toFixed(0);
    player['Team Poss'] = formatted ? `${formatted}%` : null;
  }
}
