import { isFreeAgent } from '@/computing/ldcUtils';

export interface LdcDataAvailability {
  playersTotal: number;
  playersWithDivision: number;
  playersWithNation: number;
}

function toText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/**
 * Assesses whether imported player rows carry the columns LDC needs.
 * Without usable Division values every player is treated as a free agent and
 * LDC silently becomes a no-op; without Based In data league matching
 * degrades to name-only identity. Nation (player nationality) is not a
 * substitute for Based In (the league's country) - scoring never reads it.
 */
export function assessLdcDataAvailability(
  playerRows: readonly Record<string, unknown>[]
): LdcDataAvailability {
  const playersWithDivision = playerRows.filter(
    (player) => !isFreeAgent(toText(player.Division))
  ).length;
  const playersWithNation = playerRows.filter(
    (player) => toText(player['Based In']).trim().length > 0
  ).length;

  return { playersTotal: playerRows.length, playersWithDivision, playersWithNation };
}
