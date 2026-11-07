import { ShieldAlert } from 'lucide-react';

import { useUiText } from '@/hooks/useUiText';

import { DetailSection } from './uiPrimitives';

export function DataQualitySection({
  attrWarnings,
  statWarnings
}: {
  attrWarnings: string[];
  statWarnings: string[];
}) {
  const t = useUiText();

  if (attrWarnings.length === 0 && statWarnings.length === 0) {
    return null;
  }

  return (
    <DetailSection title={t('data_quality')} testId="player-details-data-quality">
      <div className="flex items-start gap-3 rounded-2xl border border-warning/20 bg-warning/10 p-4 text-sm text-text-primary">
        <ShieldAlert className="mt-0.5 h-4 w-4 text-warning" />
        <div>
          <div className="font-semibold">{t('data_quality_summary')}</div>
          <div className="mt-1 text-text-secondary">
            {[...attrWarnings, ...statWarnings].join(' ')}
          </div>
        </div>
      </div>
    </DetailSection>
  );
}
