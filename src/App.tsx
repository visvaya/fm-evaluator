import { AlertTriangle, Database, RefreshCw, Upload } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { errorText } from '@/utils/errorText';

import { CompatibilityHost } from './components/CompatibilityHost';
import { FileManagerModal } from './components/FileManagerModal';
import Header from './components/Header';
import { ImportStatusBanner } from './components/ImportStatusBanner';
import { LeftRail } from './components/LeftRail';
import PlayerTable from './components/PlayerTable';
import { PlayerDetails } from './features/playerDetails/PlayerDetails';
import { useAppShortcuts } from './features/workspace/shortcuts';
import { useWorkspaceSurfaceSync } from './features/workspace/useWorkspaceSurfaceSync';
import { useDataBoundary } from './hooks/useDataBoundary';
import { useUiText } from './hooks/useUiText';
import { initializeLegacyBootstrap } from './lib/legacyBootstrap';
import { cn } from './lib/utils';
import { useTableStore } from './store/useTableStore';

const App: React.FC = () => {
  const t = useUiText();
  const { bootstrap, data, filteredData, importStatus, setBootstrapState } = useTableStore();
  const { isProcessing, processFiles } = useDataBoundary();
  const [isDragging, setIsDragging] = useState(false);
  const hasData = data.length > 0;

  useAppShortcuts();
  useWorkspaceSurfaceSync();

  useEffect(() => {
    let cancelled = false;

    void initializeLegacyBootstrap()
      .then(() => {
        if (!cancelled) {
          setBootstrapState({ error: null, ready: true });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setBootstrapState({
            error: errorText(error),
            ready: false
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [setBootstrapState]);

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);

    if (!bootstrap.ready || !event.dataTransfer.files) {
      return;
    }

    await processFiles(event.dataTransfer.files);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!bootstrap.ready || !event.target.files) {
      return;
    }

    await processFiles(event.target.files);
  };

  const showLoadingOverlay = isProcessing || importStatus.kind === 'processing';

  return (
    <div
      className={cn(
        'min-h-screen bg-background text-text-primary transition-colors duration-300',
        isDragging && bootstrap.ready && 'bg-accent/5'
      )}
      onDragOver={(event) => {
        event.preventDefault();
        if (bootstrap.ready) {
          setIsDragging(true);
        }
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <CompatibilityHost />
      <FileManagerModal />
      <Header />

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[1920px] flex-col">
        <ImportStatusBanner />

        {hasData ? null : (
          <div className="border-b border-border px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-text-muted">
                  <Database className="h-4 w-4 text-accent" />
                  <span>{t('app_name')}</span>
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
                  {t('react_runtime_title')}
                </h1>
              </div>
              <div className="flex items-center gap-6 text-sm text-text-secondary">
                <div>
                  <span className="font-semibold text-text-primary">{filteredData.length}</span>
                  <span className="mx-1">/</span>
                  <span>{data.length}</span>
                </div>
                <div className={bootstrap.ready ? 'text-positive' : 'text-warning'}>
                  {bootstrap.ready ? t('runtime_ready') : t('runtime_bootstrapping')}
                </div>
              </div>
            </div>
          </div>
        )}

        {bootstrap.error ? (
          <div className="px-6 py-8">
            <div className="rounded-2xl border border-negative/20 bg-negative/5 p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-negative" />
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-text-primary">
                    {t('bootstrap_failed')}
                  </h2>
                  <p className="text-sm text-text-secondary">{bootstrap.error}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative flex flex-1 border-t border-border bg-surface/20">
            {isDragging && bootstrap.ready ? (
              <div className="pointer-events-none absolute inset-6 z-40 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-accent/10 backdrop-blur-[2px]">
                <Upload className="mb-4 h-12 w-12 text-accent" />
                <h2 className="text-xl font-semibold text-accent">{t('drop_zone_title')}</h2>
                <p className="text-sm text-text-secondary">{t('supported_file_types')}</p>
              </div>
            ) : null}

            <div
              id="loading-overlay"
              className={
                showLoadingOverlay
                  ? 'absolute inset-0 z-[60] flex items-center justify-center bg-background/60 backdrop-blur-[1px]'
                  : 'hidden'
              }
            >
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-accent" />
                <p className="text-sm font-semibold text-text-primary">
                  {importStatus.message || t('processing')}
                </p>
              </div>
            </div>

            <LeftRail />

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {data.length === 0 ? (
                <div
                  id="drop-zone-container"
                  className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center"
                >
                  <div id="drop-area" className="flex flex-col items-center">
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[1.5rem] border border-border bg-surface shadow-xl">
                      <Upload className="h-8 w-8 text-accent" />
                    </div>
                    <h2 className="text-xl font-semibold text-text-primary">
                      <span id="drop-area-text">{t('no_data_loaded')}</span>
                    </h2>
                    <p className="mt-3 max-w-xl text-sm text-text-secondary">
                      {bootstrap.ready ? t('start_analysis_hint') : t('compat_runtime_loading')}
                    </p>
                    <label
                      className={cn(
                        'mt-8 rounded-xl px-6 py-3 text-sm font-semibold shadow-lg transition',
                        bootstrap.ready
                          ? 'cursor-pointer bg-accent text-white hover:bg-accent-hover'
                          : 'cursor-not-allowed bg-border text-text-muted'
                      )}
                    >
                      {t('drop_zone_title')}
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        disabled={!bootstrap.ready}
                        onChange={(event) => {
                          void handleFileSelect(event);
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <PlayerTable />
              )}
            </div>

            <PlayerDetails />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
