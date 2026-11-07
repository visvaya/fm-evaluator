import { useUiText } from '@/hooks/useUiText';

import { MetricBreakdownTable } from './MetricBreakdownTable';
import { DetailSection, WarningBlock } from './uiPrimitives';

import type { PlayerDetailsComparisonRuntime } from './comparisonRuntime';
import type { PlayerDetailsModel } from './models';
import type { Player } from '@/ui/types';

interface AttributeAnalysisSectionProps {
  comparisonRuntime: PlayerDetailsComparisonRuntime;
  currentPosition: string;
  model: PlayerDetailsModel;
  player: Player;
}

export function AttributeAnalysisSection({
  comparisonRuntime,
  currentPosition,
  model,
  player
}: AttributeAnalysisSectionProps) {
  const t = useUiText();

  return (
    <DetailSection title={t('attribute_analysis')} testId="player-details-attribute-analysis">
      <div className="space-y-3">
        {model.attrWarnings.map((warning) => (
          <WarningBlock key={warning}>{warning}</WarningBlock>
        ))}
        <MetricBreakdownTable
          comparisonRuntime={comparisonRuntime}
          currentPosition={currentPosition}
          kind="attribute"
          player={player}
          rows={model.attrRows}
          testId="player-details-attribute-table"
        />
      </div>
    </DetailSection>
  );
}
