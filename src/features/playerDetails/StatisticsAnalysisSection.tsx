import { useUiText } from '@/hooks/useUiText';

import { MetricBreakdownTable } from './MetricBreakdownTable';
import { DetailSection, WarningBlock } from './uiPrimitives';

import type { PlayerDetailsComparisonRuntime } from './comparisonRuntime';
import type { PlayerDetailsModel } from './models';
import type { Player } from '@/ui/types';

interface StatisticsAnalysisSectionProps {
  comparisonRuntime: PlayerDetailsComparisonRuntime;
  currentPosition: string;
  model: PlayerDetailsModel;
  player: Player;
}

export function StatisticsAnalysisSection({
  comparisonRuntime,
  currentPosition,
  model,
  player
}: Readonly<StatisticsAnalysisSectionProps>) {
  const t = useUiText();

  return (
    <DetailSection title={t('statistics_analysis')} testId="player-details-statistics-analysis">
      <div className="space-y-3">
        {model.statWarnings.map((warning) => (
          <WarningBlock key={warning} tone={warning.includes('minut') ? 'negative' : 'warning'}>
            {warning}
          </WarningBlock>
        ))}
        <MetricBreakdownTable
          comparisonRuntime={comparisonRuntime}
          currentPosition={currentPosition}
          kind="stat"
          player={player}
          rows={model.statRows}
          testId="player-details-stat-table"
        />
      </div>
    </DetailSection>
  );
}
