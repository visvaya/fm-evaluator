import { useUiText } from '@/hooks/useUiText';

import { PlayerMetricComparison } from './PlayerMetricComparison';

import type { PlayerDetailsComparisonRuntime } from './comparisonRuntime';
import type { PlayerMetricBreakdownRow } from './models';
import type { Player } from '@/ui/types';

interface MetricBreakdownTableProps {
  comparisonRuntime: PlayerDetailsComparisonRuntime;
  currentPosition: string;
  kind: 'attribute' | 'stat';
  player: Player;
  rows: PlayerMetricBreakdownRow[];
  testId?: string;
}

export function MetricBreakdownTable({
  comparisonRuntime,
  currentPosition,
  kind,
  player,
  rows,
  testId
}: MetricBreakdownTableProps) {
  const t = useUiText();

  return (
    <div data-testid={testId} className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-background/80 text-text-muted">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">
              {kind === 'attribute' ? t('attribute_short') : t('stat_short')}
            </th>
            <th className="px-3 py-2 text-right font-semibold">{t('value_short')}</th>
            <th className="px-3 py-2 text-right font-semibold">{t('percentile_short')}</th>
            <th className="px-3 py-2 text-right font-semibold">{t('weight_short')}</th>
            <th className="px-3 py-2 text-right font-semibold">{t('points_short')}</th>
            <th className="px-3 py-2 text-right font-semibold">
              <span className="sr-only">{t('show_comparison')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.label}-${row.rawValue}`}
              className="border-t border-border/60 align-top"
            >
              <td className="px-3 py-2 font-semibold text-text-primary">{row.label}</td>
              <td className="px-3 py-2 text-right font-mono text-text-primary">{row.rawValue}</td>
              <td className="px-3 py-2 text-right font-mono text-text-secondary">
                {row.percentile === null ? '–' : `${row.percentile}%`}
              </td>
              <td className="px-3 py-2 text-right font-mono text-text-secondary">{row.weight}</td>
              <td className="px-3 py-2 text-right font-mono font-semibold text-text-primary">
                {row.score === null ? '–' : row.score.toFixed(2)}
              </td>
              <td className="px-3 py-2 text-right">
                <PlayerMetricComparison
                  comparisonRuntime={comparisonRuntime}
                  currentPosition={currentPosition}
                  item={row}
                  kind={kind}
                  player={player}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
