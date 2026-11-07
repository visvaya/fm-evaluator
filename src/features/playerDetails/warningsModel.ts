import type { PlayerMetricBreakdownRow } from './modelTypes';
import type { Player } from '@/ui/types';

export function getAttrWarnings(attrRows: PlayerMetricBreakdownRow[]): string[] {
  return [
    attrRows.some((row) => row.isMissing)
      ? 'Wartość co najmniej jednego kluczowego atrybutu nie jest znana nawet jako zakres.'
      : null,
    attrRows.some((row) => row.isRange)
      ? 'Co najmniej jeden kluczowy atrybut jest zakresem, a nie dokładną wartością.'
      : null
  ].filter((warning): warning is string => warning !== null);
}

export function getStatWarnings(player: Player, statRows: PlayerMetricBreakdownRow[]): string[] {
  return [
    player.isLow
      ? 'Zawodnik rozegrał mniej niż wymagana liczba minut, więc jego ocena statystyczna nie została obliczona.'
      : null,
    statRows.some((row) => row.isMissing && !row.isLow)
      ? 'Brakuje co najmniej jednej kluczowej statystyki.'
      : null
  ].filter((warning): warning is string => warning !== null);
}
