import { useCallback } from 'react';

import { handleFiles } from '../data/handleFiles';
import { runAnalysis as runImportedAnalysis } from '../lib/analysisService';
import { t as i18nT, getCurrentLanguage } from '../lib/i18nBridge';
import { useTableStore } from '../store/useTableStore';

const UI_MESSAGE_FALLBACKS = {
  analysis_failed: 'Analysis failed.',
  analysis_in_progress: 'Analyzing {position} with {engine}...',
  analysis_rendered_rows: 'Rendered {count} player rows.',
  file_processing_failed: 'File processing failed.',
  processing_files: 'Processing {count} file{plural}...'
} as const;

function formatFallbackMessage(
  template: string,
  params: Record<string, number | string> = {}
): string {
  return template.replaceAll(/\{(\w+)\}/g, (_match, key: string) => String(params[key] ?? ''));
}

function t(key: string, params?: Record<string, number | string>): string {
  const translated = i18nT(key, 'ui', params);
  if (translated !== key) {
    return translated;
  }

  return formatFallbackMessage(
    UI_MESSAGE_FALLBACKS[key as keyof typeof UI_MESSAGE_FALLBACKS] ?? key,
    params
  );
}

export const useDataBoundary = () => {
  const {
    bootstrap,
    currentEngine,
    currentPosition,
    importStatus,
    isAnalyzing,
    setAnalyzing,
    setData,
    setFilteredData,
    setImportStatus
  } = useTableStore();
  const processingPlural = getCurrentLanguage() === 'pl' ? 'ów' : 's';

  const runAnalysis = useCallback(
    (engine: string, position: string) => {
      if (!bootstrap.ready || !position) {
        return;
      }

      setAnalyzing(true);
      setImportStatus({
        canRetry: false,
        details: [],
        kind: 'processing',
        message: t('analysis_in_progress', { engine, position })
      });

      try {
        const results = runImportedAnalysis(engine, position);
        setData(results);
        setFilteredData(results);
        setImportStatus({
          canRetry: false,
          details: [],
          kind: 'success',
          message: t('analysis_rendered_rows', { count: results.length })
        });
      } catch (error) {
        console.error('[DataBoundary] Analysis failed:', error);
        setImportStatus({
          canRetry: false,
          details: [error instanceof Error ? error.message : String(error)],
          kind: 'error',
          message: t('analysis_failed')
        });
      } finally {
        setAnalyzing(false);
      }
    },
    [bootstrap.ready, setAnalyzing, setData, setFilteredData, setImportStatus]
  );

  const processFiles = useCallback(
    async (files: File[] | FileList) => {
      if (!bootstrap.ready) {
        return;
      }

      setImportStatus({
        canRetry: false,
        details: [],
        kind: 'processing',
        message: t('processing_files', {
          count: files.length,
          plural: files.length === 1 ? '' : processingPlural
        })
      });

      try {
        await handleFiles(files);
      } catch (error) {
        console.error('[DataBoundary] handleFiles failed:', error);
        setImportStatus({
          canRetry: true,
          details: [error instanceof Error ? error.message : String(error)],
          kind: 'error',
          message: t('file_processing_failed')
        });
      }
    },
    [bootstrap.ready, processingPlural, setImportStatus]
  );

  return {
    isProcessing: isAnalyzing || importStatus.kind === 'processing',
    processFiles,
    runAnalysis,
    selectedEngine: currentEngine,
    selectedPosition: currentPosition
  };
};
