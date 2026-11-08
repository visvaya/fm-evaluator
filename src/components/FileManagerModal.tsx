import { ArrowDown, ArrowUp, GripVertical, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';

import { IMPORT_LIMITS } from '@/config/importLimits';
import { formatCutCellColumns, type CutCellCount } from '@/data/importedCellText';
import { useDataBoundary } from '@/hooks/useDataBoundary';
import { useUiText } from '@/hooks/useUiText';
import { cn } from '@/lib/utils';
import { useTableStore } from '@/store/useTableStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { fileStack } from '@/ui/fileStack';

interface FileStackItem {
  cutCells?: CutCellCount[];
  detectedLanguage?: string;
  missingOptional?: string[];
  missingRequired?: string[];
  name?: string;
  rowCount?: number;
  type?: string;
}

interface LegacyFileStackActions {
  remap: (index: number) => Promise<void> | void;
  remove: (index: number) => Promise<void> | void;
  reorder: (fromIndex: number, toIndex: number) => void;
}

function resolveLegacyFileStackActions(): LegacyFileStackActions {
  const legacyWindow = window as Window & {
    remapFileHeaders?: (index: number) => Promise<void> | void;
    removeFileFromStack?: (index: number) => Promise<void> | void;
  };

  return {
    remap: async (index: number) => {
      if (typeof fileStack.remap === 'function') {
        await fileStack.remap(index);
        return;
      }
      await legacyWindow.remapFileHeaders?.(index);
    },
    remove: async (index: number) => {
      if (typeof fileStack.remove === 'function') {
        await fileStack.remove(index);
        return;
      }
      await legacyWindow.removeFileFromStack?.(index);
    },
    reorder: (fromIndex: number, toIndex: number) => {
      if (typeof fileStack.reorder === 'function') {
        fileStack.reorder(fromIndex, toIndex);
        return;
      }
      const currentStack = (window as Window & { processor?: { fileStack?: FileStackItem[] } })
        .processor?.fileStack;
      if (!Array.isArray(currentStack)) {
        return;
      }
      const item = currentStack[fromIndex];
      if (!item) {
        return;
      }
      currentStack.splice(fromIndex, 1);
      currentStack.splice(toIndex, 0, item);
    }
  };
}

const languageNames: Record<string, string> = {
  da: 'Dansk',
  de: 'Deutsch',
  el: 'Ellenika',
  en: 'English',
  'en-us': 'English (US)',
  es: 'Espanol',
  fr: 'Francais',
  it: 'Italiano',
  ja: 'Nihongo',
  ko: 'Hangugeo',
  nl: 'Nederlands',
  no: 'Norsk',
  pl: 'Polski',
  pt: 'Portugues',
  ru: 'Russkiy',
  sv: 'Svenska',
  tr: 'Turkce',
  zh: 'Zhongwen'
};

const typeLabels: Record<string, string> = {
  attr: 'Attributes',
  both: 'Incomplete',
  complete: 'Complete',
  stats: 'Statistics',
  unknown: 'Unknown'
};

function readFileStack(): FileStackItem[] {
  const stack = (window as Window & { processor?: { fileStack?: FileStackItem[] } }).processor
    ?.fileStack;
  if (!Array.isArray(stack)) {
    return [];
  }

  return [...stack];
}

export function FileManagerModal() {
  const t = useUiText();
  const { processFiles } = useDataBoundary();
  const { bootstrap, mergeMode, setMergeMode } = useTableStore();
  const { closeFileManager, isFileManagerOpen } = useWorkspaceStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPendingAction, setIsPendingAction] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<null | number>(null);
  const [stack, setStack] = useState<FileStackItem[]>([]);
  const legacyFileStackActions = useMemo(() => resolveLegacyFileStackActions(), []);

  const refreshStack = useCallback(() => {
    setStack(readFileStack());
  }, []);

  useEffect(() => {
    if (!isFileManagerOpen) {
      return;
    }

    refreshStack();
    const intervalId = window.setInterval(refreshStack, 400);
    return () => window.clearInterval(intervalId);
  }, [isFileManagerOpen, refreshStack]);

  useEffect(() => {
    if (!isFileManagerOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeFileManager();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeFileManager, isFileManagerOpen]);

  const onFilesPicked = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !bootstrap.ready) {
        return;
      }

      setIsPendingAction(true);
      try {
        await processFiles(files);
      } finally {
        refreshStack();
        setIsPendingAction(false);
      }
    },
    [bootstrap.ready, processFiles, refreshStack]
  );

  const onRemove = useCallback(
    async (index: number) => {
      setIsPendingAction(true);
      try {
        await legacyFileStackActions.remove(index);
      } finally {
        refreshStack();
        setIsPendingAction(false);
      }
    },
    [legacyFileStackActions, refreshStack]
  );

  const onRemap = useCallback(
    async (index: number) => {
      setIsPendingAction(true);
      try {
        await legacyFileStackActions.remap(index);
      } finally {
        refreshStack();
        setIsPendingAction(false);
      }
    },
    [legacyFileStackActions, refreshStack]
  );

  const onReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) {
        return;
      }

      legacyFileStackActions.reorder(fromIndex, toIndex);
      refreshStack();
    },
    [legacyFileStackActions, refreshStack]
  );

  const modalDescription = useMemo(() => {
    if (stack.length === 0) {
      return t('drop_zone_subtitle');
    }

    return t('displayed_rows', 'ui', {
      end: stack.length,
      start: 1,
      total: stack.length
    });
  }, [stack.length, t]);

  if (!isFileManagerOpen) {
    return null;
  }

  return (
    <div
      data-testid="file-manager-modal-backdrop"
      className="fixed inset-0 z-[135] flex items-center justify-center bg-background/70 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeFileManager();
        }
      }}
    >
      <div
        data-testid="file-manager-modal"
        className="w-full max-w-4xl rounded-2xl border border-border bg-background p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{t('manage_files')}</h2>
            <p className="mt-1 text-sm text-text-secondary">{modalDescription}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-text-secondary transition hover:bg-surface hover:text-text-primary"
            onClick={closeFileManager}
            aria-label={t('close')}
            title={t('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
          <section className="space-y-4">
            <label
              className={cn(
                'flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition',
                isDragOver ? 'border-accent bg-accent/5' : 'border-border bg-surface/60',
                (!bootstrap.ready || isPendingAction) && 'cursor-not-allowed opacity-60'
              )}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                if (event.currentTarget === event.target) {
                  setIsDragOver(false);
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDrop={async (event) => {
                event.preventDefault();
                setIsDragOver(false);
                await onFilesPicked(event.dataTransfer.files);
              }}
            >
              <Upload className="h-7 w-7 text-accent" />
              <div className="text-sm font-semibold text-text-primary">{t('drop_files_here')}</div>
              <div className="text-xs text-text-secondary">{t('supported_file_types')}</div>
              <input
                id="react-files-input-modal"
                type="file"
                className="hidden"
                multiple
                disabled={!bootstrap.ready || isPendingAction}
                onChange={(event) => {
                  void onFilesPicked(event.target.files);
                  event.currentTarget.value = '';
                }}
              />
            </label>

            <div className="space-y-2">
              {stack.length === 0 ? (
                <div className="rounded-2xl border border-border bg-surface/40 px-4 py-6 text-center text-sm text-text-secondary">
                  {t('no_data_loaded')}
                </div>
              ) : (
                stack.map((item, index) => {
                  const rowCount = item.rowCount ?? 0;
                  const fileName = item.name ?? 'unknown.html';
                  const type = item.type ?? 'unknown';
                  const typeLabel = typeLabels[type] ?? typeLabels.unknown;
                  const detectedLanguage = item.detectedLanguage ?? 'en';
                  const languageLabel =
                    languageNames[detectedLanguage] ?? detectedLanguage.toUpperCase();
                  const missingRequired = item.missingRequired ?? [];
                  const missingOptional = item.missingOptional ?? [];
                  const cutCells = item.cutCells ?? [];

                  return (
                    <article
                      key={`${fileName}-${index}`}
                      className="rounded-2xl border border-border bg-background/80 p-3"
                      draggable
                      onDragStart={() => setDraggedIndex(index)}
                      onDragOver={(event: DragEvent<HTMLElement>) => {
                        event.preventDefault();
                      }}
                      onDrop={(event: DragEvent<HTMLElement>) => {
                        event.preventDefault();
                        if (draggedIndex === null) {
                          return;
                        }

                        onReorder(draggedIndex, index);
                        setDraggedIndex(null);
                      }}
                      onDragEnd={() => setDraggedIndex(null)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface text-text-muted">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-sm font-semibold text-text-primary">
                              {fileName}
                            </div>
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                              {typeLabel}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-text-secondary">
                            {t('file_manager_file_summary', 'ui', {
                              count: rowCount,
                              language: languageLabel
                            })}
                          </div>
                          {missingRequired.length > 0 ? (
                            <div className="mt-2 text-xs text-negative">
                              {t('file_manager_missing_required', 'ui', {
                                columns: missingRequired.join(', ')
                              })}
                            </div>
                          ) : null}
                          {missingOptional.length > 0 ? (
                            <div className="mt-1 text-xs text-warning">
                              {t('file_manager_missing_optional', 'ui', {
                                columns: missingOptional.join(', ')
                              })}
                            </div>
                          ) : null}
                          {cutCells.length > 0 ? (
                            <div className="mt-1 text-xs text-warning">
                              {t('file_manager_cells_cut', 'ui', {
                                columns: formatCutCellColumns(cutCells),
                                limit: IMPORT_LIMITS.cellTextLengthChars
                              })}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onReorder(index, Math.max(0, index - 1))}
                            disabled={index === 0}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-text-secondary transition hover:bg-surface hover:text-text-primary disabled:opacity-40"
                            aria-label={t('file_manager_move_up')}
                            title={t('file_manager_move_up')}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onReorder(index, Math.min(stack.length - 1, index + 1))}
                            disabled={index === stack.length - 1}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-text-secondary transition hover:bg-surface hover:text-text-primary disabled:opacity-40"
                            aria-label={t('file_manager_move_down')}
                            title={t('file_manager_move_down')}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void onRemap(index);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-text-secondary transition hover:bg-surface hover:text-text-primary"
                            aria-label={t('file_manager_remap_headers')}
                            title={t('file_manager_remap_headers')}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void onRemove(index);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-negative transition hover:bg-negative/10"
                            aria-label={t('file_manager_remove_file')}
                            title={t('file_manager_remove_file')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <aside className="space-y-3 rounded-2xl border border-border bg-surface/35 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
              {t('merge_mode')}
            </div>
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary">
              <input
                type="radio"
                name="react-merge-mode"
                checked={mergeMode === 'merge'}
                onChange={() => setMergeMode('merge')}
              />
              <span>
                <span className="font-semibold">{t('merge_mode_combine')}</span>
                <span className="mt-1 block text-xs text-text-secondary">
                  {t('merge_mode_combine_desc')}
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary">
              <input
                type="radio"
                name="react-merge-mode"
                checked={mergeMode === 'replace'}
                onChange={() => setMergeMode('replace')}
              />
              <span>
                <span className="font-semibold">{t('merge_mode_replace')}</span>
                <span className="mt-1 block text-xs text-text-secondary">
                  {t('merge_mode_overwrite_desc')}
                </span>
              </span>
            </label>
          </aside>
        </div>
      </div>
    </div>
  );
}
