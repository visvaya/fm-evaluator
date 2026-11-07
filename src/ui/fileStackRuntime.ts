import { continueImportFlowProcessing } from '../lib/legacyActionBridge';

import { reportFileStackCriticalError, syncFileStackViews } from './fileStackUi';

interface FileStackItemLike {
  html?: string;
}

interface FileStackProcessor<TFileStackItem> {
  fileStack?: TFileStackItem[];
}

export function getFileStackItems<TFileStackItem>(
  processor: FileStackProcessor<TFileStackItem>
): TFileStackItem[] {
  return processor.fileStack ?? [];
}

export function getFileStackItem<TFileStackItem>(
  processor: FileStackProcessor<TFileStackItem>,
  index: number
): null | TFileStackItem {
  const fileStack = getFileStackItems(processor);
  if (index < 0 || index >= fileStack.length) {
    return null;
  }

  return fileStack[index] ?? null;
}

export function hasFileStackItems<TFileStackItem>(processor: FileStackProcessor<TFileStackItem>) {
  return getFileStackItems(processor).length > 0;
}

export function getExistingFileStackNames<TFileStackItem extends { name?: string }>(
  processor: FileStackProcessor<TFileStackItem>
) {
  return new Set(getFileStackItems(processor).map((fileMeta) => fileMeta.name));
}

export function shouldAppendToFileStack<TFileStackItem>(
  processor: FileStackProcessor<TFileStackItem>,
  nextFileIndex: number
) {
  return hasFileStackItems(processor) || nextFileIndex > 0;
}

export function hasRemappableHtml(fileMeta: FileStackItemLike | null) {
  return Boolean(fileMeta?.html);
}

export function finalizeFileStackMutation(
  onRenderMain: () => void,
  onRenderModal: () => void = () => {}
) {
  syncFileStackViews(onRenderMain, onRenderModal);
  continueImportFlowProcessing();
}

export function handleFileStackCriticalError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown file stack error';
  console.error('Critical error removing file:', error);
  reportFileStackCriticalError(message);
}
