import { Check, Copy } from 'lucide-react';
import { useState, type MouseEvent } from 'react';

import { getPlayerRowModel } from '@/features/table/playerRowModel';
import { useUiText } from '@/hooks/useUiText';
import { copyTextToClipboard } from '@/lib/clipboard';
import { cn } from '@/lib/utils';

import { PlayerAvatar } from './PlayerAvatar';

import type { Player } from '@/ui/types';

interface PlayerNameCellProps {
  player: Player;
}

export function PlayerNameCell({ player }: PlayerNameCellProps) {
  const t = useUiText();
  const [copied, setCopied] = useState(false);
  const row = getPlayerRowModel(player);

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const didCopy = await copyTextToClipboard(row.displayName);
    if (!didCopy) {
      return;
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="flex items-start gap-3">
      <PlayerAvatar label={row.displayName} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-text-primary">
              {row.displayName}
            </div>
            <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
              {row.uid}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            data-testid="player-name-copy"
            className={cn(
              'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background/90 text-text-muted transition hover:border-border hover:bg-surface hover:text-text-primary',
              copied && 'border-positive/30 bg-positive/10 text-positive'
            )}
            aria-label={copied ? t('copied') : t('copy')}
            title={copied ? t('copied') : t('copy')}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="truncate text-[10px] font-medium uppercase tracking-[0.16em] text-text-secondary">
          {row.subtitle}
        </div>
      </div>
    </div>
  );
}
