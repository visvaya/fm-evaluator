import i18n, { type TranslationCategory } from '../i18n';
import { continueImportFlowProcessing } from '../lib/legacyActionBridge';
import { fileStackTypeLabels, renderFileStackCards } from './fileStackCards';
import {
  finalizeFileStackMutation,
  getFileStackItems,
  getFileStackItem,
  handleFileStackCriticalError,
  hasFileStackItems,
  hasRemappableHtml
} from './fileStackRuntime';
import {
  buildUpdatedColumnMap,
  extractHeadersForRemap,
  requestUserMappings
} from './fileStackRemap';
import {
  removeFileStackItem,
  rebuildFileStackCollections,
  rebuildFileStackCollectionsWithFallback,
  reorderFileStackItems,
  reparseFileStackItem
} from './fileStackState';
import {
  attachFileStackDragDrop,
  getFileStackContainer,
  reportFileStackCriticalError,
  renderActiveFileStackState,
  renderEmptyFileStackState,
  setLoadingOverlayVisible,
  syncFileStackViews,
  waitForNextPaint
} from './fileStackUi';
// t is a property of i18n default export or named export?
// The default export has t method.
const t = (key: string, category: TranslationCategory = 'ui', params?: any) =>
  i18n.t(key, category, params);

// We need access to the global processor for now as it holds the state
// In later phases, we should inject this state or move it to a store
declare global {
  interface Window {
    addAudit?: (...args: any[]) => void;
    HeaderMappingModal: any;
    processor: any;
    renderFileStackModal?: () => void;
  }
}

interface FileStackManagerItem {
  columnMap?: Record<number, string>;
  detectedLanguage?: string;
  file?: File | null;
  html?: string;
  missingOptional?: string[];
  missingRequired?: string[];
  name: string;
  rowCount: number;
  type: string;
}

export class FileStackManager {
  private get processor() {
    return window.processor;
  }

  public async remap(fileIndex: number): Promise<void> {
    const fileMeta = getFileStackItem<FileStackManagerItem>(this.processor, fileIndex);
    if (!hasRemappableHtml(fileMeta)) {
      console.error('No file data to remap');
      return;
    }

    if (window.HeaderMappingModal === undefined) {
      alert('HeaderMappingModal not loaded');
      return;
    }

    try {
      const headers = extractHeadersForRemap(fileMeta.html, this.processor.normalizeHeader);
      const currentColumnMap = fileMeta.columnMap ?? {};

      const detectedLanguage = fileMeta.detectedLanguage || 'en';
      const languageConfig =
        await this.processor.languageConfigLoader.loadLanguageConfig(detectedLanguage);

      setLoadingOverlayVisible(false);

      const userMappings = await requestUserMappings({
        currentColumnMap,
        fileName: fileMeta.name || 'unknown',
        HeaderMappingModal: window.HeaderMappingModal,
        headers,
        languageConfig,
        schemaRegistry: this.processor.schemaRegistry
      });

      setLoadingOverlayVisible(true);

      if (!userMappings) {
        setLoadingOverlayVisible(false);
        return;
      }

      const newColumnMap = buildUpdatedColumnMap(currentColumnMap, userMappings);

      removeFileStackItem(this.processor, fileIndex);
      rebuildFileStackCollections(this.processor);
      await reparseFileStackItem(this.processor, fileMeta, newColumnMap);

      finalizeFileStackMutation(
        () => {
          this.render();
        },
        () => window.renderFileStackModal?.()
      );

      setLoadingOverlayVisible(false);
    } catch (error: any) {
      console.error('Remap error:', error);
      alert(`Error remapping: ${error.message}`);
      setLoadingOverlayVisible(false);
    }
  }

  public async remove(index: number): Promise<void> {
    if (!getFileStackItem<FileStackManagerItem>(this.processor, index)) return;

    setLoadingOverlayVisible(true);

    await waitForNextPaint();

    try {
      removeFileStackItem(this.processor, index);
      await rebuildFileStackCollectionsWithFallback(this.processor, async (meta) => {
        console.warn('[FileStack] No cache for file, reparsing...', meta.name);
        try {
          await reparseFileStackItem(this.processor, meta);
        } catch (error) {
          console.error('Error reparsing file:', error);
        }
      });

      finalizeFileStackMutation(
        () => {
          this.render();
        },
        () => window.renderFileStackModal?.()
      );
    } catch (error: any) {
      handleFileStackCriticalError(error);
    } finally {
      setLoadingOverlayVisible(false);
    }
  }

  public render(containerId = 'file-stack'): void {
    const fileStackContainer = getFileStackContainer(containerId);
    if (!fileStackContainer) return;
    if (!this.processor?.fileStack) {
      return;
    }

    if (!hasFileStackItems(this.processor)) {
      renderEmptyFileStackState(fileStackContainer);
      return;
    }

    const fileStackItems = getFileStackItems<FileStackManagerItem>(this.processor);
    console.log('[FileStack] Rendering', fileStackItems.length, 'files');
    renderActiveFileStackState(
      fileStackContainer,
      renderFileStackCards(fileStackItems, {
        typeLabels: fileStackTypeLabels.default
      })
    );

    attachFileStackDragDrop(containerId, (from, to) => this.reorder(from, to));
  }

  public reorder(oldIndex: number, newIndex: number): void {
    reorderFileStackItems(this.processor, oldIndex, newIndex);

    syncFileStackViews(
      () => {
        this.render();
      },
      () => window.renderFileStackModal?.()
    );
  }
}

export const fileStack = new FileStackManager();
