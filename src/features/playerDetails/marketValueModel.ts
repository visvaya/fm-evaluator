import { translatePosition } from '@/i18n/translate';

import type { PlayerRatioCardModel } from './modelTypes';
import type { Player } from '@/ui/types';

function formatRatingBadge(rating: null | string | undefined): null | string {
  if (!rating || rating === 'fair') {
    return null;
  }

  return rating === 'niedoceniony' ? '↓ Niedoceniony' : '↑ Przeceniony';
}

function formatRatioValue(ratio: null | number): {
  tone: PlayerRatioCardModel['tone'];
  value: string;
} {
  if (ratio === null || ratio === undefined) {
    return { tone: 'warning', value: 'N/A' };
  }

  if (ratio >= 1.2) {
    return { tone: 'positive', value: `${ratio.toFixed(2)}x` };
  }

  if (ratio <= 0.8) {
    return { tone: 'negative', value: `${ratio.toFixed(2)}x` };
  }

  return { tone: 'neutral', value: `${ratio.toFixed(2)}x` };
}

export function getBestRoleSummary(player: Player): string[] {
  const translatedRoles = [
    player.bestRole?.totalRole || player.bestRole?.role,
    player.bestRole?.statRole,
    player.bestRole?.attrRole
  ]
    .filter(Boolean)
    .map((role) => translatePosition(String(role)));

  return [...new Set(translatedRoles)];
}

export function getRatioCards(player: Player): PlayerRatioCardModel[] {
  return [
    {
      ...formatRatioValue(player.scorePerValue ?? null),
      badgeText: formatRatingBadge(player.valueRating),
      helper: 'Expected Value Ratio (Total)',
      label: 'xVal Ratio'
    },
    {
      ...formatRatioValue(player.scorePerWage ?? null),
      badgeText: formatRatingBadge(player.wageRating),
      helper: 'Expected Wage Ratio (Total)',
      label: 'xWage Ratio'
    },
    {
      ...formatRatioValue(player.scorePerValueStat ?? null),
      badgeText: null,
      helper: 'Expected Value Ratio (Stat Score)',
      label: 'xVal Ratio (Stat)'
    },
    {
      ...formatRatioValue(player.scorePerWageStat ?? null),
      badgeText: null,
      helper: 'Expected Wage Ratio (Stat Score)',
      label: 'xWage Ratio (Stat)'
    },
    {
      ...formatRatioValue(player.scorePerValueAtr ?? null),
      badgeText: null,
      helper: 'Expected Value Ratio (Attr Score)',
      label: 'xVal Ratio (Attr)'
    },
    {
      ...formatRatioValue(player.scorePerWageAtr ?? null),
      badgeText: null,
      helper: 'Expected Wage Ratio (Attr Score)',
      label: 'xWage Ratio (Attr)'
    }
  ];
}
