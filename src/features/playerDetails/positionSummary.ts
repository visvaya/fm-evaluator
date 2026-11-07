import { translatePosition } from '@/i18n/translate';

import type { Player } from '@/ui/types';

export function getPositionSummary(player: Player): { primary: string; secondary: null | string } {
  const secondaryPositions = Array.isArray(player.pos2Array)
    ? player.pos2Array.filter((position) => position?.trim() && position.trim() !== '-')
    : [];
  const secondarySet = new Set(secondaryPositions.map((position) => position.toLowerCase()));
  const primaryPositions = Array.isArray(player.positionArray)
    ? player.positionArray.filter((position) => !secondarySet.has(position.toLowerCase()))
    : [];

  const primary = (primaryPositions.length > 0 ? primaryPositions : [player.position || '–'])
    .filter(Boolean)
    .map((position) => translatePosition(String(position).trim()))
    .join(', ');

  const secondary =
    secondaryPositions.length > 0
      ? secondaryPositions.map((position) => translatePosition(position.trim())).join(', ')
      : null;

  return {
    primary: primary || '–',
    secondary
  };
}
