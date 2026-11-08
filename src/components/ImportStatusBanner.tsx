import { AlertCircle, CheckCircle2, Info, RefreshCw } from 'lucide-react';

import { useUiText } from '@/hooks/useUiText';
import { useTableStore } from '@/store/useTableStore';

function StatusIcon({ kind }: { kind: string }) {
  if (kind === 'error') {
    return <AlertCircle className="h-4 w-4 text-negative" />;
  }

  if (kind === 'success') {
    return <CheckCircle2 className="h-4 w-4 text-positive" />;
  }

  if (kind === 'processing') {
    return <RefreshCw className="h-4 w-4 animate-spin text-accent" />;
  }

  return <Info className="h-4 w-4 text-text-secondary" />;
}

export function ImportStatusBanner() {
  const t = useUiText();
  const importStatus = useTableStore((state) => state.importStatus);

  return (
    <div className="space-y-3 px-6 pt-4">
      <div
        id="upload-status-text"
        data-react-managed="true"
        aria-live="polite"
        className={
          importStatus.kind === 'idle'
            ? 'hidden'
            : 'rounded-xl border border-border bg-surface/80 px-4 py-3'
        }
      >
        <div className="upload-status-content flex items-center gap-3 text-sm font-medium text-text-primary">
          <StatusIcon kind={importStatus.kind} />
          <span>{importStatus.message || ''}</span>
        </div>
        {importStatus.kind !== 'error' && importStatus.details.length > 0 ? (
          <ul className="mt-2 space-y-1 pl-7 text-xs text-warning">
            {importStatus.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div
        id="error-log"
        data-react-managed="true"
        aria-live="polite"
        className={
          importStatus.kind === 'error'
            ? 'rounded-xl border border-negative/20 bg-negative/5 px-4 py-3'
            : 'hidden'
        }
      >
        <div className="error-log-content whitespace-pre-line text-sm text-text-secondary">
          {importStatus.details.join('\n')}
        </div>
      </div>

      <div
        id="retry-error-container"
        data-react-managed="true"
        className={importStatus.canRetry ? '' : 'hidden'}
      >
        <button
          id="retry-files-btn"
          type="button"
          onClick={() => {
            void (
              window as Window & { retryFailedFiles?: () => void | Promise<void> }
            ).retryFailedFiles?.();
          }}
          className={
            importStatus.canRetry
              ? 'inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface'
              : 'hidden'
          }
        >
          <RefreshCw className="h-4 w-4" />
          <span>{t('retry')}</span>
        </button>
      </div>
    </div>
  );
}
