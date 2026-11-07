import { useUiText } from '@/hooks/useUiText';
import { cn } from '@/lib/utils';

import { PlayerMetricComparison } from './PlayerMetricComparison';
import { DetailSection } from './uiPrimitives';

import type { PlayerDetailsComparisonRuntime } from './comparisonRuntime';
import type { PlayerDetailsModel } from './models';
import type { Player } from '@/ui/types';

interface RoleRequirementsSectionProps {
  comparisonRuntime: PlayerDetailsComparisonRuntime;
  currentPosition: string;
  model: PlayerDetailsModel;
  player: Player;
}

function getValueClassName(passed: boolean, skipped?: boolean) {
  if (passed) {
    return 'text-positive';
  }

  if (skipped) {
    return 'text-warning';
  }

  return 'text-negative';
}

export function RoleRequirementsSection({
  comparisonRuntime,
  currentPosition,
  model,
  player
}: RoleRequirementsSectionProps) {
  const t = useUiText();

  return (
    <DetailSection title={t('role_requirements')} testId="player-details-role-requirements">
      <div className="space-y-3">
        {model.roleRequirements.length > 0 ? (
          model.roleRequirements.map((item) => (
            <div
              key={`${item.label}-${item.limit}`}
              className="rounded-2xl border border-border bg-background/70 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-text-primary">{item.label}</div>
                  <div className="text-xs text-text-secondary">
                    {t('limit_label')}: {item.limit}
                  </div>
                </div>
                <div
                  className={cn(
                    'text-sm font-semibold',
                    getValueClassName(item.passed, item.skipped)
                  )}
                >
                  {item.value}
                </div>
              </div>
              <PlayerMetricComparison
                comparisonRuntime={comparisonRuntime}
                currentPosition={currentPosition}
                item={item}
                kind="filter"
                player={player}
              />
            </div>
          ))
        ) : (
          <div className="text-sm text-text-secondary">{t('no_role_requirements')}</div>
        )}
      </div>
    </DetailSection>
  );
}
