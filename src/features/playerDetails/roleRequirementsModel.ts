import { POSITION_FILTERS } from '@/config/scoreConfig';

import type { RoleRequirementItem } from './modelTypes';
import type { Player } from '@/ui/types';

function formatRoleRequirementLimit(limit: unknown): string {
  if (typeof limit === 'number') {
    return String(limit);
  }

  if (typeof limit === 'object' && limit !== null && 'max' in limit) {
    const maxLimit = limit.max;
    return typeof maxLimit === 'number' ? `≤ ${maxLimit}` : '–';
  }

  return '–';
}

function getChartValue(value: unknown): null | number {
  if (value === null || value === undefined || value === '' || value === '-') {
    return null;
  }

  return Number.isFinite(Number(value)) ? Number(value) : null;
}

export function formatRoleRequirements(player: Player): RoleRequirementItem[] {
  if (Array.isArray(player.filters) && player.filters.length > 0) {
    return player.filters.map((item) => ({
      chartValue: getChartValue(item.val),
      label: item.name,
      limit: item.limit,
      passed: Boolean(item.passed),
      skipped: Boolean(item.skipped),
      sourceKey: item.name,
      value: String(item.val ?? '–')
    }));
  }

  if (player.bestRole?.role) {
    const roleKey = player.bestRole.role.split('/')[0];
    const filters = POSITION_FILTERS[roleKey] || {};
    return Object.entries(filters).map(([label, limit]) => ({
      chartValue: null,
      label,
      limit: formatRoleRequirementLimit(limit),
      passed: false,
      sourceKey: label,
      value: '–'
    }));
  }

  return [];
}
