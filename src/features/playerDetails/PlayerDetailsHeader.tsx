import { Copy, X } from 'lucide-react';

import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useUiText } from '@/hooks/useUiText';
import { cn } from '@/lib/utils';

import type { PlayerDetailsModel } from './models';

interface PlayerDetailsHeaderProps {
  copied: boolean;
  graphicsEnabled: boolean;
  model: PlayerDetailsModel;
  onClose: () => void;
  onCopy: () => void;
}

export function PlayerDetailsHeader({
  copied,
  graphicsEnabled,
  model,
  onClose,
  onCopy
}: PlayerDetailsHeaderProps) {
  const t = useUiText();

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            UID <span className="font-mono text-text-primary">{model.uid}</span>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-text-primary md:text-4xl">
              {model.name}
            </h2>
            <button
              type="button"
              onClick={onCopy}
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-text-muted transition hover:bg-surface hover:text-text-primary',
                copied && 'border-positive/20 bg-positive/10 text-positive'
              )}
              aria-label={copied ? t('copied') : t('copy')}
              title={copied ? t('copied') : t('copy')}
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <div className="inline-flex rounded-full border border-positive/20 bg-positive/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-positive">
            {model.suggestion}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-border p-2 text-text-secondary transition hover:bg-surface hover:text-text-primary"
          aria-label={t('close')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <section className="rounded-3xl border border-border bg-surface/70 p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row">
          <PlayerAvatar label={graphicsEnabled ? model.graphicsLabel : model.name} size="lg" />
          <div className="grid flex-1 gap-3 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  {t('club', 'columns')}
                </div>
                <div className="font-semibold text-text-primary">
                  {model.club}
                  <span className="ml-2 font-normal text-text-secondary">{model.league}</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  {t('position', 'columns')}
                </div>
                <div className="font-semibold text-text-primary">{model.positionSummary}</div>
                {model.secondaryPositionSummary ? (
                  <div className="mt-1 text-sm text-text-secondary">
                    {model.secondaryPositionSummary}
                  </div>
                ) : null}
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  {t('age', 'columns')}
                </div>
                <div className="font-semibold text-text-primary">{model.age}</div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  {t('foot', 'columns')}
                </div>
                <div className="font-semibold text-text-primary">{model.footSummary}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  {t('mins', 'columns')}
                </div>
                <div className="font-semibold text-text-primary">{model.mins}</div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    {t('value', 'columns')}
                  </div>
                  <div className="font-semibold text-text-primary">{model.value}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    {t('wage', 'columns')}
                  </div>
                  <div className="font-semibold text-text-primary">{model.wage}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {model.bestRoleSummary.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-border bg-background/70 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              {t('best_role_summary')}
            </div>
            <div className="mt-2 text-sm font-semibold text-text-primary">
              {model.bestRoleSummary.join(' / ')}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
