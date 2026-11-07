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
  // --- SYSTEM REKONSTRUKCJI STATYSTYK BRAMKARSKICH ---
  // Zamiast naprawiać zepsute wartości z pliku, całkowicie je rekonstruujemy z surowych danych

  // 1. Rekonstrukcja interwencji i strzałów
  const svt = getN('Svt');
  const svp = getN('Svp');
  const svh = getN('Svh');
  const totalSaves = svt + svp + svh;

  const conc = getN('Conc');
  // Shots Faced = Obrony + Puszczone Gole
  const shotsFaced = totalSaves + conc;

  // 2. NewSaves/90 (Obliczamy jako suma Svh + Svt + Svp * factor90, nadpisujemy wartość 'Saves/90' z pliku precyzyjnym wyliczeniem)
  // W pliku wartości są zaokrąglone do liczb całkowitych (np. 1 lub 2), co jest mało dokładne.
  if (mins > 0 && totalSaves >= 0) {
    player['Saves/90'] = (totalSaves * factor90).toFixed(2); // Zapisujemy jako 'Saves/90' dla kompatybilności
  }

  // 3. NewSv % (Obliczamy jako (Svt + Svp + Svh) / ((Svt + Svp + Svh) + Conc) * 100%, nadpisujemy wartość 'Sv %' z pliku)
  // Wzór: NewSv % = totalSaves / shotsFaced * 100, gdzie shotsFaced = totalSaves + Conc
  if (shotsFaced > 0) {
    const calculatedSvPct = (totalSaves / shotsFaced) * 100;
    player['Sv %'] = calculatedSvPct.toFixed(1); // Zapisujemy jako 'Sv %' dla kompatybilności, np. 77.4%
  } else {
    player['Sv %'] = '0.0';
  }

  // 4. xSv % (Obliczamy na podstawie xGP)
  // Wzór: Expected Save % = (Expected Saves / Shots Faced) * 100
  // Odtwarzamy xG Against: xG = Conc + xGP (bo xGP = xG - Conc)
  // Expected Saves = Shots Faced - xG

  const xgpVal = getV('xGP');

  if (xgpVal !== null && shotsFaced > 0) {
    // Odtwarzamy xG, z którym mierzył się bramkarz
    const reconstructedXG = conc + xgpVal;

    // Obliczamy oczekiwaną skuteczność
    // Jeśli xG wynosiło 12.37 na 31 strzałów, to xSv% = (31 - 12.37) / 31 * 100
    const expectedSaves = shotsFaced - reconstructedXG;
    const calculatedXSvPct = (expectedSaves / shotsFaced) * 100;

    player['xSv %'] = calculatedXSvPct.toFixed(1);
  }
  // Jeśli brak xGP, xSv % pozostaje null (nie ma danych do obliczenia)

  // 5. Save Efficiency (Ważona skuteczność interwencji)
  // Pozostaje bez zmian, bo opiera się na surowych danych
  if (!hasValue('Save Efficiency') && totalSaves > 0) {
    const weightedScore = svh * 3 + svt * 2 + svp * 1;
    player['Save Efficiency'] = (weightedScore / totalSaves).toFixed(2);
  }
}
