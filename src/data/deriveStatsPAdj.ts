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
  // Possession-adjusted defensive stats (zgodnie z FM Data Lab)
  // PAdj_Stat = Stat_90 * 50 / (100 - AvgPossession)
  // gdzie AvgPossession to średnie posiadanie piłki drużyny w %.
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

  // Ogranicz do bezpiecznego zakresu, aby uniknąć dzielenia przez 0
  const possessionClamped = Math.max(0, Math.min(95, basePossession));
  let timeInDefense = 100 - possessionClamped;
  // Minimalny czas w obronie, aby uniknąć ekstremalnych mnożników
  timeInDefense = Math.max(timeInDefense, 5);

  const padjFactor = 50 / timeInDefense;

  // Lista statystyk per 90 do przeliczenia
  const padjTargets = [
    { dest: 'PAdj Tck A', src: 'Tck A/90' }, // Tackles Attempted
    { dest: 'PAdj Int', src: 'Int/90' }, // Interceptions
    { dest: 'PAdj Clr', src: 'Clr/90' }, // Clearances
    { dest: 'PAdj Blk', src: 'Blk/90' }, // Blocks
    { dest: 'PAdj Pres A', src: 'Pres A/90' } // Pressures Attempted
  ];

  padjTargets.forEach((stat) => {
    // Nie nadpisuj, jeśli wartość już istnieje (np. z pliku)
    if (hasValue(stat.dest)) return;
    const rawVal = parseFloat(player[stat.src]);
    player[stat.dest] = isNaN(rawVal) ? null : (rawVal * padjFactor).toFixed(2);
  });

  // Zachowaj użyte posiadanie jako informację pomocniczą (liczba całkowita %)
  if (!hasValue('Team Poss')) {
    const possNumber = Number(basePossession);
    const formatted = isNaN(possNumber) ? '' : possNumber.toFixed(0);
    player['Team Poss'] = formatted ? `${formatted}%` : null;
  }
}
