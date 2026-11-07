import { loadLeagueMappings } from '@/computing/ldcMappings';
import { canonicalizeNation } from '@/computing/ldcNations';
import {
  autoMapLeague,
  fuzzyMatchLeague,
  improvedLeagueMatching,
  isFreeAgent,
  normalizeLeagueNameForGrouping
} from '@/computing/ldcUtils';
import { ldcSettings } from '@/config/ldcConfig';
import { getPlayerRuntimeRows } from '@/lib/playerRuntimeCache';

import { buildMissingLeagueCandidates } from './missingLeaguesModel';

import type { MissingLeagueCandidate } from './missingLeaguesModel';

export function detectMissingLeagues(): MissingLeagueCandidate[] {
  const playerRows = getPlayerRuntimeRows();
  if (playerRows.length === 0) {
    return [];
  }

  return buildMissingLeagueCandidates(
    playerRows,
    ldcSettings.leagues,
    loadLeagueMappings(),
    {
      autoMapLeague,
      fuzzyMatchLeague,
      improvedLeagueMatching,
      isFreeAgent,
      mapCountryCode: canonicalizeNation,
      normalizeLeagueNameForGrouping
    },
    ldcSettings.model === 'basket'
  );
}
