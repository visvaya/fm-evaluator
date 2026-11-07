import { useUiText } from '@/hooks/useUiText';
import { cn } from '@/lib/utils';

import { DetailSection } from './uiPrimitives';

import type { PlayerRatioCardModel } from './models';

export function MarketValueSection({
  ratioCards
}: Readonly<{ ratioCards: PlayerRatioCardModel[] }>) {
  const t = useUiText();

  return (
    <DetailSection title={t('market_value_analysis')} testId="player-details-market-value">
      <div className="grid gap-3 md:grid-cols-2">
        {ratioCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-border bg-background/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                {card.label}
              </div>
              {card.badgeText ? (
                <div className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
                  {card.badgeText}
                </div>
              ) : null}
            </div>
            <div
              className={cn(
                'mt-3 text-2xl font-semibold tracking-tight',
                card.tone === 'positive' && 'text-positive',
                card.tone === 'negative' && 'text-negative',
                card.tone === 'warning' && 'text-warning',
                card.tone === 'neutral' && 'text-text-primary'
              )}
            >
              {card.value}
            </div>
            <div className="mt-1 text-xs text-text-secondary">{card.helper}</div>
          </div>
        ))}
      </div>
    </DetailSection>
  );
}
