import { removeUntilStable } from '@/utils/removeUntilStable';

const REMEMBER_LANGUAGE_CHOICE_KEY = 'fm24-evaluator-remember-language-choice';
const FILE_LANGUAGE_CHOICE_KEY = 'fm24-evaluator-file-language-choice';

interface ParserStateProcessor {
  attributes?: unknown[];
  detectedFileLanguages?: string[];
  stats?: unknown[];
}

interface ResolvePostImportLanguageDecisionArgs {
  currentLanguage: null | string;
  detectedLanguage: null | string;
  localStorageLike: Pick<Storage, 'getItem'>;
  sessionStorageLike: Pick<Storage, 'getItem'>;
}

interface ParseImportedHtmlArgs {
  file: File;
  fileNumber: number;
  html: string;
  onStatus: (message: string, currentFile: null | number, totalFiles: null | number) => void;
  parseHTML: (
    html: string,
    forceType?: null | string,
    append?: boolean,
    file?: File | null,
    preMappedColumnMap?: null | Record<number, string>,
    progressCallback?: (stage: string, details?: unknown) => void,
    batchInfo?: { current: number; total: number }
  ) => Promise<unknown>;
  shouldAppend: boolean;
  totalFiles: number;
}

interface PrepareImportedFilesArgs {
  files: Iterable<File>;
  force?: boolean;
  isKnownDuplicateName: (file: File) => boolean;
  isKnownDuplicateHash?: (file: File) => Promise<boolean>;
  onDuplicateHashCheckFailed?: (file: File, error: unknown) => void;
  onFileAccepted?: (file: File) => void;
  onFileRejected?: (file: File, reason: string) => void;
}

interface ProcessImportedFilesBatchArgs {
  files: File[];
  onParseError?: (file: File, error: unknown) => void;
  onReadError?: (file: File) => void;
  onStatus: (message: string, currentFile: null | number, totalFiles: null | number) => void;
  parseHTML: ParseImportedHtmlArgs['parseHTML'];
  readText?: (file: File) => Promise<string>;
  shouldAppendAtIndex: (index: number) => boolean;
}

interface RecordImportedFilesMetadataArgs {
  files: Iterable<File>;
  onRecordError?: (file: File, error: unknown) => void;
  recordFile: (file: File) => Promise<void>;
}

interface ContinueImportAfterParsingArgs {
  onContinue: () => void;
  processor: ParserStateProcessor;
  waitForParsedCollectionsImpl?: typeof waitForParsedCollections;
}

export interface ProcessImportedFilesBatchResult {
  cancelled: boolean;
  errors: string[];
  failedFiles: File[];
  filesWithErrors: Map<string, File>;
  loadedTypes: string[];
  processedCount: number;
}

export interface PrepareImportedFilesResult {
  failedFiles: File[];
  newFiles: File[];
}

export type PostImportLanguageDecision =
  | { kind: 'continue' }
  | { kind: 'show-choice'; currentLanguage: string; detectedLanguage: string }
  | { kind: 'switch-and-continue'; language: string };

export function hasParsedCollections(processor: ParserStateProcessor): boolean {
  return (processor.attributes?.length ?? 0) > 0 || (processor.stats?.length ?? 0) > 0;
}

export async function waitForParsedCollections(
  processor: ParserStateProcessor,
  timeoutMs = 2000,
  wait: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => window.setTimeout(resolve, ms))
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (hasParsedCollections(processor)) {
      return;
    }

    await wait(50);
  }
}

export function getDominantDetectedLanguage(processor: ParserStateProcessor): null | string {
  const detectedFileLanguages = processor.detectedFileLanguages ?? [];
  if (detectedFileLanguages.length === 0) {
    return null;
  }

  const fileLangCounts: Record<string, number> = {};
  detectedFileLanguages.forEach((lang) => {
    fileLangCounts[lang] = (fileLangCounts[lang] || 0) + 1;
  });

  return Object.entries(fileLangCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

export function getRememberedFileLanguageChoice(
  localStorageLike: Pick<Storage, 'getItem'>,
  sessionStorageLike: Pick<Storage, 'getItem'>
): null | string {
  const rememberEnabled = localStorageLike.getItem(REMEMBER_LANGUAGE_CHOICE_KEY) === 'true';
  if (rememberEnabled) {
    try {
      const rememberedLanguage = localStorageLike.getItem(FILE_LANGUAGE_CHOICE_KEY);
      if (rememberedLanguage) {
        return rememberedLanguage;
      }
    } catch (error) {
      console.warn('Could not read language choice from localStorage:', error);
    }
  }

  try {
    return sessionStorageLike.getItem(FILE_LANGUAGE_CHOICE_KEY);
  } catch (error) {
    console.warn('Could not read language choice from sessionStorage:', error);
    return null;
  }
}

export function resolvePostImportLanguageDecision({
  currentLanguage,
  detectedLanguage,
  localStorageLike,
  sessionStorageLike
}: ResolvePostImportLanguageDecisionArgs): PostImportLanguageDecision {
  if (!currentLanguage || !detectedLanguage || detectedLanguage === currentLanguage) {
    return { kind: 'continue' };
  }

  const rememberedLanguage = getRememberedFileLanguageChoice(localStorageLike, sessionStorageLike);
  if (rememberedLanguage && rememberedLanguage === detectedLanguage) {
    return { kind: 'switch-and-continue', language: rememberedLanguage };
  }

  if (rememberedLanguage && rememberedLanguage === currentLanguage) {
    return { kind: 'continue' };
  }

  return {
    kind: 'show-choice',
    currentLanguage,
    detectedLanguage
  };
}

/**
 * Strips inline styles and handlers before parsing. Not a security control: imported text is
 * escaped where it is rendered.
 */
export function sanitizeImportedHtml(html: string): string {
  return removeUntilStable(html, [/<style>.*?<\/style>/g, /on\w+=/g]);
}

export async function prepareImportedFiles({
  files,
  force = false,
  isKnownDuplicateName,
  isKnownDuplicateHash,
  onDuplicateHashCheckFailed,
  onFileAccepted,
  onFileRejected
}: PrepareImportedFilesArgs): Promise<PrepareImportedFilesResult> {
  const failedFiles: File[] = [];
  const newFiles: File[] = [];

  for (const file of files) {
    if (!force && isKnownDuplicateName(file)) {
      failedFiles.push(file);
      onFileRejected?.(file, 'duplicate-name');
      continue;
    }

    if (!force && isKnownDuplicateHash) {
      try {
        if (await isKnownDuplicateHash(file)) {
          failedFiles.push(file);
          onFileRejected?.(file, 'duplicate-hash');
          continue;
        }
      } catch (error) {
        onDuplicateHashCheckFailed?.(file, error);
      }
    }

    newFiles.push(file);
    onFileAccepted?.(file);
  }

  return {
    failedFiles,
    newFiles
  };
}

export async function recordImportedFilesMetadata({
  files,
  onRecordError,
  recordFile
}: RecordImportedFilesMetadataArgs): Promise<void> {
  for (const file of files) {
    try {
      await recordFile(file);
    } catch (error) {
      onRecordError?.(file, error);
    }
  }
}

export async function continueImportAfterParsing({
  onContinue,
  processor,
  waitForParsedCollectionsImpl = waitForParsedCollections
}: ContinueImportAfterParsingArgs): Promise<void> {
  await waitForParsedCollectionsImpl(processor);
  onContinue();
}

export async function parseImportedHtml({
  file,
  fileNumber,
  html,
  onStatus,
  parseHTML,
  shouldAppend,
  totalFiles
}: ParseImportedHtmlArgs): Promise<unknown> {
  const sanitizedHtml = sanitizeImportedHtml(html);
  const batchInfo = { current: fileNumber, total: totalFiles };

  return parseHTML(
    sanitizedHtml,
    null,
    shouldAppend,
    file,
    null,
    (stage) => {
      const stageMessages: Record<string, string> = {
        detecting: `Wykrywam język: ${file.name}...`,
        processing: `Przetwarzam: ${file.name}...`
      };
      const stageMessage = stageMessages[stage];
      if (stageMessage) {
        onStatus(stageMessage, fileNumber, totalFiles);
      }
    },
    batchInfo
  );
}

async function readImportedFileText(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', (event) => {
      resolve(String(event.target?.result ?? ''));
    });
    reader.onerror = () => {
      reject(new Error('Błąd odczytu pliku'));
    };
    reader.readAsText(file);
  });
}

export interface PostImportLanguageDecisionCallbacks {
  continueImport: () => Promise<void>;
  setLanguage: (lang: string) => void;
  showChoiceModal: (detected: string, current: string) => void;
}

export async function applyPostImportLanguageDecision(
  decision: PostImportLanguageDecision,
  callbacks: PostImportLanguageDecisionCallbacks
): Promise<boolean> {
  if (decision.kind === 'switch-and-continue') {
    callbacks.setLanguage(decision.language);
    await callbacks.continueImport();
    return true;
  }
  if (decision.kind === 'show-choice') {
    callbacks.showChoiceModal(decision.detectedLanguage, decision.currentLanguage);
    return true;
  }
  return false;
}

export async function processImportedFilesBatch({
  files,
  onParseError,
  onReadError,
  onStatus,
  parseHTML,
  readText = readImportedFileText,
  shouldAppendAtIndex
}: ProcessImportedFilesBatchArgs): Promise<ProcessImportedFilesBatchResult> {
  const errors: string[] = [];
  const failedFiles: File[] = [];
  const filesWithErrors = new Map<string, File>();
  const loadedTypes: string[] = [];
  const totalFiles = files.length;
  let cancelled = false;
  let processedCount = 0;

  for (const [index, file] of files.entries()) {
    if (cancelled) {
      break;
    }

    const fileNumber = index + 1;
    onStatus(`Odczytuję plik: ${file.name}...`, fileNumber, totalFiles);

    let html: string;
    try {
      html = await readText(file);
    } catch (error) {
      processedCount += 1;
      const errorMsg = `${file.name}: Błąd odczytu pliku`;
      errors.push(errorMsg);
      failedFiles.push(file);
      filesWithErrors.set(errorMsg, file);
      onReadError?.(file);
      onStatus(`Błąd odczytu: ${file.name}`, fileNumber, totalFiles);
      continue;
    }

    try {
      onStatus(`Przetwarzam: ${file.name}...`, fileNumber, totalFiles);
      const result = await parseImportedHtml({
        file,
        fileNumber,
        html,
        onStatus,
        parseHTML,
        shouldAppend: shouldAppendAtIndex(index),
        totalFiles
      });
      if (result && typeof result === 'object' && 'type' in result) {
        loadedTypes.push((result as { type: string }).type);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Anuluj wszystkie')) {
        cancelled = true;
        onStatus('Anulowano przetwarzanie pozostałych plików', null, null);
        break;
      }

      processedCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      const errorMsg = `${file.name}: ${message}`;
      errors.push(errorMsg);
      failedFiles.push(file);
      filesWithErrors.set(errorMsg, file);
      onParseError?.(file, error);
      onStatus(`Błąd: ${file.name}`, fileNumber, totalFiles);
    }
  }

  return {
    cancelled,
    errors,
    failedFiles,
    filesWithErrors,
    loadedTypes,
    processedCount
  };
}
