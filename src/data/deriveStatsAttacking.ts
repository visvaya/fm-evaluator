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
      // Zabezpieczenie logiczne: Cr C <= Cr A
      if (crA > 0 && crC !== null && crC <= crA) {
        const percentage = (crC / crA) * 100;
        // Walidacja: wynik procentowy powinien być w zakresie 0-100%
        if (percentage >= 0 && percentage <= 100) {
          player['Cr C %'] = percentage.toFixed(2);
        }
      }
    }
  }

  // --- NEW STATS FROM DOC ---
  // NP-xG/Shot
  // Wersja precyzyjna: wykorzystuje Pens (Taken) lub wylicza z Pens S + Pen/R
  if (!hasValue('NP-xG/Shot')) {
    const totalShotsRaw = getV('Shots');
    const totalXG = getV('xG');

    if (totalShotsRaw !== null && totalXG !== null) {
      // KROK 1: Ustalenie liczby prób rzutów karnych (Attempts)
      let penAttempts = 0;

      // Pobieramy wartości bezpośrednie
      const pensTaken = getV('Pens'); // Penalties Taken
      const pensScored = getV('Pens S'); // Penalties Scored

      if (pensTaken !== null && pensTaken > 0) {
        // Wariant idealny: Mamy kolumnę "Pens" (Taken)
        penAttempts = pensTaken;
      } else if (pensScored !== null && pensScored > 0) {
        // Wariant awaryjny: Mamy tylko gole i skuteczność
        let penRatio = getV('Pen R'); // np. 100%, 0.5 etc.

        if (penRatio === null || penRatio === 0) {
          penAttempts = pensScored; // Zakładamy 100% skuteczności przy braku danych
        } else {
          if (penRatio > 1) penRatio = penRatio / 100; // Zamiana 100 -> 1.0
          penAttempts = Math.round(pensScored / penRatio);
        }
      }

      // ZABEZPIECZENIE: Próby karne nie mogą przekraczać liczby wszystkich strzałów
      // (Chroni przed błędami w danych FM, np. gdy Shots nie zliczyło karnego)
      penAttempts = Math.min(penAttempts, totalShotsRaw);

      // KROK 2: Obliczenie NP-xG (xG z gry)
      // Odejmujemy penaltyXGFactor xG za każdą próbę karnego
      const penaltyFactor = useSettingsStore.getState().settings.penaltyXGFactor || 0.76;
      const npxG = Math.max(0, totalXG - penaltyFactor * penAttempts);

      // KROK 3: Obliczenie NP-Shots (Strzały z gry)
      // Odejmujemy próby karne od wszystkich strzałów
      // Minimum 1 aby uniknąć dzielenia przez 0, ale jeśli totalShotsRaw - penAttempts <= 0, to nie obliczamy
      const npShots = Math.max(1, totalShotsRaw - penAttempts);

      // KROK 4: Wynik
      // Jeśli zawodnik oddał strzały z gry, dzielimy xG z gry przez strzały z gry
      if (npShots > 0 && totalShotsRaw - penAttempts > 0) {
        const result = npxG / npShots;
        // Walidacja końcowego wyniku: upewnić się że nie jest ujemny
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
      // Zabezpieczenie logiczne: Shots >= Gls (nie można strzelić więcej goli niż było strzałów)
      if (gls !== null && shots !== null && shots > 0 && shots >= gls) {
        const percentage = (gls / shots) * 100;
        // Walidacja: wynik procentowy powinien być w zakresie 0-100%
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

    // Jeśli Gls Out nie istnieje, sprawdź czy jest Goals Outside Box/90
    if (goalsOutside === null) {
      let goalsOutside90 = getV('Goals Outside Box/90');
      if (goalsOutside90 === null) goalsOutside90 = getV('Gls Out/90');
      if (goalsOutside90 !== null && mins > 0) {
        // KROK 1: Odtworzenie liczby goli z dystansu z wartości "per 90"
        const rawGoalsOutside = (goalsOutside90 * mins) / 90;
        // KROK 2: Zaokrąglenie do liczby całkowitej, bo gole są dyskretne
        goalsOutside = Math.round(rawGoalsOutside);
      }
    }

    if (goalsTotal !== null && goalsOutside !== null && goalsTotal > 0) {
      // KROK 3: Gole z dystansu nie mogą przekraczać sumy wszystkich goli
      goalsOutside = Math.min(goalsOutside, goalsTotal);

      const goalsInside = goalsTotal - goalsOutside;

      // Zabezpieczenie logiczne: goalsInside nie może być ujemne
      if (goalsInside >= 0) {
        const percentage = (goalsInside / goalsTotal) * 100;

        // Walidacja: wynik procentowy powinien być w zakresie 0-100%
        if (percentage >= 0 && percentage <= 100) {
          player['Gls In Box %'] = percentage.toFixed(2);
        }
      }
    }
  }

  // In Box Conv % (goalsInside / shotsInside) * 100
  if (!hasValue('In Box Conv %')) {
    // 1. Obliczamy liczbę goli w polu karnym
    const goalsTotal = getV('Gls');
    let goalsOutside = getV('Gls Out');

    // Jeśli Gls Out nie istnieje, sprawdź czy jest Goals Outside Box/90
    if (goalsOutside === null) {
      let goalsOutside90 = getV('Goals Outside Box/90');
      if (goalsOutside90 === null) goalsOutside90 = getV('Gls Out/90');
      if (goalsOutside90 !== null && mins > 0) {
        // KROK 1: Odtworzenie liczby goli z dystansu z wartości "per 90"
        const rawGoalsOutside = (goalsOutside90 * mins) / 90;
        // KROK 2: Zaokrąglenie do liczby całkowitej, bo gole są dyskretne
        goalsOutside = Math.round(rawGoalsOutside);
      }
    }

    if (goalsTotal !== null && goalsOutside !== null) {
      // KROK 3: Gole z dystansu nie mogą przekraczać sumy wszystkich goli
      goalsOutside = Math.min(goalsOutside, goalsTotal);
      const goalsInside = goalsTotal - goalsOutside;

      // Walidacja: goalsInside nie może być ujemne
      if (goalsInside >= 0) {
        // 2. Obliczamy liczbę strzałów zza pola karnego (zamieniamy /90 na liczbę całkowitą)
        let shotsOutside90 = getV('Shots Outside Box/90');
        if (shotsOutside90 === null) shotsOutside90 = getV('Shts Out/90');
        const shotsTotal = getV('Shots');

        if (shotsOutside90 !== null && mins > 0 && shotsTotal !== null && shotsTotal > 0) {
          // KROK 1: Odtworzenie z wartości per-90
          const rawShotsOutside = (shotsOutside90 * mins) / 90;
          // KROK 2: Zaokrąglenie do liczby całkowitej
          let shotsOutside = Math.round(rawShotsOutside);
          // KROK 3: Zabezpieczenie (nie przekracza maksimum)
          shotsOutside = Math.min(shotsOutside, shotsTotal);

          // 3. Obliczamy liczbę strzałów w polu karnym
          const shotsInside = shotsTotal - shotsOutside;

          // 4. Walidacja i wynik w % (zabezpieczenie przed dzieleniem przez 0 i ujemnymi wartościami)
          if (
            shotsInside > 0 &&
            shotsInside <= shotsTotal && // ZABEZPIECZENIE LOGICZNE: liczba strzałów w polu karnym nie może być mniejsza niż liczba goli w polu karnym
            // Jeśli shotsInside < goalsInside, oznacza to błąd w danych (np. rzuty karne wliczane jako gole, ale nie jako strzały)
            shotsInside >= goalsInside
          ) {
            const percentage = (goalsInside / shotsInside) * 100;

            // Walidacja: wynik procentowy powinien być w zakresie 0-100%
            // 100% = zawodnik strzelił gol z każdego strzału w polu karnym (maksimum logiczne)
            if (percentage >= 0 && percentage <= 100) {
              player['In Box Conv %'] = percentage.toFixed(2);
            }
            // Jeśli wynik poza zakresem 0-100%, nie zapisujemy wartości (pozostaje null)
          }
          // Jeśli shotsInside < goalsInside, nie zapisujemy wartości (błąd danych)
        }
      }
    }
  }

  // ShT % (Shots on Target / Shots)
  if (!hasValue('ShT %') && getV('ShT') !== null && getV('Shots') !== null) {
    const shots = getV('Shots');
    const shT = getV('ShT');
    // Zabezpieczenie logiczne: ShT <= Shots
    if (shots > 0 && shT !== null && shT <= shots) {
      const percentage = (shT / shots) * 100;
      // Walidacja: wynik procentowy powinien być w zakresie 0-100%
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
      // KROK 1: Odtworzenie z wartości per-90
      const rawShotsOutside = (shotsOutside90 * mins) / 90;
      // KROK 2: Zaokrąglenie do liczby całkowitej
      let shotsOutside = Math.round(rawShotsOutside);
      // KROK 3: Zabezpieczenie (nie przekracza maksimum)
      shotsOutside = Math.min(shotsOutside, shotsTotal);

      // Wyliczamy strzały w polu karnym
      const shotsInside = shotsTotal - shotsOutside;

      // Zabezpieczenie logiczne: shotsInside nie może być ujemne
      if (shotsInside >= 0 && shotsInside <= shotsTotal) {
        const percentage = (shotsInside / shotsTotal) * 100;

        // Walidacja: wynik procentowy powinien być w zakresie 0-100%
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
    // Zabezpieczenie logiczne: Shts Out <= Shots
    if (shots > 0 && shtsOut !== null && shtsOut <= shots) {
      const percentage = (shtsOut / shots) * 100;
      // Walidacja: wynik procentowy powinien być w zakresie 0-100%
      if (percentage >= 0 && percentage <= 100) {
        player['Shts Out %'] = percentage.toFixed(2);
      }
    }
  }

  // Additional stats needed for STATS_CONFIG
  // xGP/90 (Expected Goals Prevented per 90) - for GK
  // Group 1: Skill/Role Specific - requires base value
  // xGP to różnica (może być ujemne, dodatnie, zero), ale tylko jeśli są strzały
  if (!hasValue('xGP/90')) {
    // Sprawdź czy są strzały: suma Svh+Svt+Svp = 0 oznacza brak strzałów
    const svh = getN('Svh');
    const svt = getN('Svt');
    const svp = getN('Svp');
    const totalSaves = svh + svt + svp;
    const hasShots = totalSaves > 0;

    if (hasShots) {
      // Są strzały - sprawdź wartość xGP
      const xGP = getV('xGP');
      if (xGP !== null) {
        player['xGP/90'] = (xGP * factor90).toFixed(2);
      } else if (isRawEmpty('xGP')) {
        // Wartość źródłowa jest pusta/null, ale są strzały - może być null (brak danych)
        player['xGP/90'] = null;
      }
    } else {
      // Brak strzałów - xGP nie może mieć wartości
      player['xGP/90'] = null;
    }
  }

  // Aer A/90 (Aerial Challenges Attempted/90)
  // Uwaga: W danych źródłowych nie ma 'Aer A', jest tylko 'Aer A/90' (które w praktyce jest Hdrs A/90)
  // Obliczamy z Hdrs A, tak samo jak Hdrs A/90
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
    // Zabezpieczenie logiczne: Pas C <= Pas A
    if (pasC !== null && pasA !== null && pasA > 0 && pasC <= pasA) {
      const percentage = (pasC / pasA) * 100;
      // Walidacja: wynik procentowy powinien być w zakresie 0-100%
      if (percentage >= 0 && percentage <= 100) {
        player['Pas %'] = percentage.toFixed(2);
      }
    }
  }

  // Hdr % (Headers Won %)
  if (!hasValue('Hdr %') && getV('Hdrs') !== null && getV('Hdrs A') !== null) {
    const hdrs = getV('Hdrs'); // Hdrs = Headers Won
    const hdrsA = getV('Hdrs A');
    // Zabezpieczenie logiczne: Hdrs <= Hdrs A
    if (hdrsA > 0 && hdrs !== null && hdrs <= hdrsA) {
      const percentage = (hdrs / hdrsA) * 100;
      // Walidacja: wynik procentowy powinien być w zakresie 0-100%
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
