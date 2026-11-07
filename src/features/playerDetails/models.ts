import { translateValue } from '@/i18n/translate';
import { formatPlayerValue, getFeetStars } from '@/utils/helpers';

import { formatBreakdownRows } from './formatBreakdownRows';
import { getBestRoleSummary, getRatioCards } from './marketValueModel';
import { getPositionSummary } from './positionSummary';
import { formatRoleRequirements } from './roleRequirementsModel';
import { getAttrWarnings, getStatWarnings } from './warningsModel';

import type { PlayerDetailsModel } from './modelTypes';
import type { Player } from '@/ui/types';

export type {
  PlayerDetailsModel,
  PlayerMetricBreakdownRow,
  PlayerRatioCardModel,
  RoleRequirementItem
} from './modelTypes';

export function getPlayerDetailsModel(player: Player): PlayerDetailsModel {
  const position = getPositionSummary(player);
  const leftStars = getFeetStars(player.leftFootValue);
  const rightStars = getFeetStars(player.rightFootValue);
  const attrRows = formatBreakdownRows(player.attrDetails);
  const statRows = formatBreakdownRows(player.statDetails);
  const attrWarnings = getAttrWarnings(attrRows);
  const statWarnings = getStatWarnings(player, statRows);
  const ratioCards = getRatioCards(player);
  const bestRoleSummary = getBestRoleSummary(player);

  return {
    age: String(player.age ?? '–'),
    attrRows,
    attrScore: Number(player.attrScore ?? 0),
    attrWarnings,
    bestRoleSummary,
    club: String(player.club ?? '–'),
    footSummary: `${translateValue(player.foot || player.basic_preferred_foot || '–', 'Preferred Foot')} (L: ${leftStars} / R: ${rightStars})`,
    graphicsLabel: player.uid ? `UID ${player.uid}` : player.name,
    league: String(player.league ?? '–'),
    mins: String(player.mins ?? '0'),
    name: String(player.name ?? '–'),
    positionSummary: position.primary,
    ratioCards,
    roleRequirements: formatRoleRequirements(player),
    secondaryPositionSummary: position.secondary,
    statRows,
    statScore: Number(player.statScore ?? 0),
    statWarnings,
    suggestion: String(player.suggestion ?? '–'),
    totalScore: Number(player.totalScore ?? 0),
    uid: String(player.uid ?? '–'),
    value: formatPlayerValue(player.value),
    wage: formatPlayerValue(player.wage)
  };
}
