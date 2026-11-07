interface FileStackItem {
  file?: File | null;
  html?: string;
  name?: string;
  parsedData?: unknown[];
  type: string;
}

interface FileStackProcessor {
  attributes: unknown[];
  fileStack: FileStackItem[];
  parseHTML: (
    html: string,
    forceType?: null | string,
    append?: boolean,
    file?: File | null,
    preMappedColumnMap?: null | Record<number, string>
  ) => Promise<unknown>;
  stats: unknown[];
}

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const movedItem = items[fromIndex];
  const itemsWithoutMoved = items.filter((_, index) => index !== fromIndex);
  return itemsWithoutMoved.toSpliced(toIndex, 0, movedItem);
}

function contributesToAttributes(type: string) {
  return type === 'attr' || type === 'both' || type === 'complete';
}

function contributesToStats(type: string) {
  return type === 'stats' || type === 'both' || type === 'complete';
}

function normalizeParseType(type: string) {
  return type === 'complete' ? 'both' : type;
}

export function rebuildFileStackCollections(processor: FileStackProcessor) {
  const reversedFileStack = processor.fileStack.toReversed();
  const attributes = reversedFileStack.flatMap((meta) =>
    meta?.parsedData && contributesToAttributes(meta.type) ? meta.parsedData : []
  );
  const stats = reversedFileStack.flatMap((meta) =>
    meta?.parsedData && contributesToStats(meta.type) ? meta.parsedData : []
  );

  // Rebuilding legacy processor collections necessarily updates processor-owned state.
  processor.attributes = attributes;
  processor.stats = stats;
}

export function removeFileStackItem(processor: FileStackProcessor, index: number) {
  const nextFileStack = processor.fileStack.filter((_, fileIndex) => fileIndex !== index);

  // File-stack mutations still update the legacy processor-owned collection directly.
  processor.fileStack = nextFileStack;
}

export function reorderFileStackItems(
  processor: FileStackProcessor,
  oldIndex: number,
  newIndex: number
) {
  if (oldIndex === newIndex) {
    return;
  }

  const nextFileStack = moveArrayItem(processor.fileStack, oldIndex, newIndex);

  // File-stack mutations still update the legacy processor-owned collection directly.
  processor.fileStack = nextFileStack;
}

export async function reparseFileStackItem(
  processor: FileStackProcessor,
  fileMeta: FileStackItem,
  columnMap?: Record<number, string>
) {
  if (!fileMeta.html) {
    throw new Error('No file data to parse');
  }

  await processor.parseHTML(
    fileMeta.html,
    normalizeParseType(fileMeta.type),
    false,
    fileMeta.file ?? null,
    columnMap ?? null
  );
}

export async function rebuildFileStackCollectionsWithFallback(
  processor: FileStackProcessor,
  onMissingParsedData?: (fileMeta: FileStackItem) => Promise<void> | void
) {
  rebuildFileStackCollections(processor);

  for (const meta of processor.fileStack.toReversed()) {
    if (meta?.parsedData) continue;
    await onMissingParsedData?.(meta);
  }
}
