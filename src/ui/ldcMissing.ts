// Phase 5D: Missing leagues detection and compatibility dialogs
// Extracted from main.js L191-382, L8791-9065, L9122-9524, L9925-10221, L10896-11039

import { addLeagueMapping } from '../computing/ldcMappings';
import { normalizeLeagueNameForGrouping } from '../computing/ldcUtils';
import { ldcSettings } from '../config/ldcConfig';
import { detectMissingLeagues } from '../features/ldc/detectMissingLeagues';
import {
  groupMissingLeagueCandidates,
  type MissingLeagueCandidate,
  type MissingLeagueCountryGroup
} from '../features/ldc/missingLeaguesModel';
import { useLdcMissingStore } from '../features/ldc/useLdcMissingStore';
import { useLdcStore } from '../features/ldc/useLdcStore';

import { calculateLDC } from './ldcModal';

export function addLeagueWithValues(
  originalName: string,
  nation: string,
  stars: null | number,
  rank: number
): void {
  const normalizedStars =
    ldcSettings.model === 'basket' && stars !== null ? Math.max(0.5, Math.min(5, stars)) : null;
  const newLeague = {
    inputScore: 0,
    ldcRaw: 0,
    multiplier: 1,
    name: originalName,
    nation,
    rank,
    stars: normalizedStars
  };

  ldcSettings.leagues.push(newLeague);
  ldcSettings.leagues.forEach((league, index) => (league.rank = index + 1));
  calculateLDC();
  void useLdcStore.getState().syncFromLegacy();
  addLeagueMapping({ name: originalName, nation }, { name: originalName, nation });
  checkMissingLeagues();
}

export function checkMissingLeagues(): void {
  const missingLeagues = detectMissingLeagues();
  const groups = groupMissingLeagues(missingLeagues);

  useLdcMissingStore.getState().hydrateMissingLeagues({
    groups,
    missingLeagues
  });

  (window as any).missingLeaguesGroups = groups;
}

// eslint-disable-next-line unicorn/prefer-export-from -- Kept as a compatibility export and used locally above.
export { detectMissingLeagues };

export function groupMissingLeagues(
  missingLeagues: MissingLeagueCandidate[]
): MissingLeagueCountryGroup[] {
  return groupMissingLeagueCandidates(missingLeagues, normalizeLeagueNameForGrouping);
}
