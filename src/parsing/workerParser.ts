/**
 * WorkerParser - parses in the Web Worker and falls back to the main thread.
 * Both paths run the same shared UniversalParser.
 */
import { getParserBridge } from '../workerBridge';

import { UniversalParser } from './universalParser.js';

import type {
  BatchParseRequest,
  FormatContext,
  LanguageConfig,
  NormalizationConfig,
  SchemaInfo
} from './parserTypes';

export type ParseMode = 'auto' | 'main-thread' | 'worker';

interface WorkerParserOptions {
  batchSize?: number;
  mode?: ParseMode;
  onModeChange?: (mode: ParseMode, reason: string) => void;
}

let currentMode: ParseMode = 'auto';
let legacyParser: null | UniversalParser = null;
let workerAvailable: boolean | null = null;

export function getParseMode(): ParseMode {
  return currentMode;
}

export async function getParserStatus(): Promise<{
  mode: ParseMode;
  workerAvailable: boolean;
}> {
  return {
    mode: currentMode,
    workerAvailable: await checkWorkerAvailable()
  };
}

export async function parseBatch(
  values: string[],
  schemaInfo: SchemaInfo,
  formatContext: Partial<FormatContext> = {},
  normalizationConfig: NormalizationConfig | null = null,
  languageConfig: LanguageConfig = {},
  options: WorkerParserOptions = {}
): Promise<unknown[]> {
  const mode = options.mode ?? currentMode;
  const batchSize = options.batchSize ?? 500;

  if (mode === 'main-thread') {
    return values.map((v) =>
      parseMainThread(v, schemaInfo, formatContext, normalizationConfig, languageConfig)
    );
  }

  if (mode === 'worker' || mode === 'auto') {
    const useWorker = await checkWorkerAvailable();

    if (useWorker) {
      try {
        const bridge = getParserBridge();
        const results: unknown[] = [];

        for (let i = 0; i < values.length; i += batchSize) {
          const chunk = values.slice(i, i + batchSize);
          const request: BatchParseRequest = {
            formatContext,
            languageConfig,
            normalizationConfig: normalizationConfig ?? undefined,
            schemaInfo,
            values: chunk
          };

          const batchResult = await bridge.parseBatch(request);
          results.push(...batchResult.results.map((r) => r.value));
        }

        return results;
      } catch (error) {
        console.warn('[WorkerParser] Worker batch failed, falling back to main thread:', error);
        options.onModeChange?.('main-thread', 'worker_batch_error');
      }
    }
  }

  return values.map((v) =>
    parseMainThread(v, schemaInfo, formatContext, normalizationConfig, languageConfig)
  );
}

export async function parseValue(
  value: string,
  schemaInfo: SchemaInfo,
  formatContext: Partial<FormatContext> = {},
  normalizationConfig: NormalizationConfig | null = null,
  languageConfig: LanguageConfig = {},
  options: WorkerParserOptions = {}
): Promise<unknown> {
  const mode = options.mode ?? currentMode;

  if (mode === 'main-thread') {
    return parseMainThread(value, schemaInfo, formatContext, normalizationConfig, languageConfig);
  }

  if (mode === 'worker' || mode === 'auto') {
    const useWorker = await checkWorkerAvailable();

    if (useWorker) {
      try {
        const bridge = getParserBridge();
        const result = await bridge.parse(
          value,
          schemaInfo,
          formatContext,
          normalizationConfig,
          languageConfig
        );
        return result.value;
      } catch (error) {
        console.warn('[WorkerParser] Worker failed, falling back to main thread:', error);
        options.onModeChange?.('main-thread', 'worker_error');
        return parseMainThread(
          value,
          schemaInfo,
          formatContext,
          normalizationConfig,
          languageConfig
        );
      }
    }
  }

  return parseMainThread(value, schemaInfo, formatContext, normalizationConfig, languageConfig);
}

export function setParseMode(mode: ParseMode): void {
  currentMode = mode;
  console.log(`[WorkerParser] Mode set to: ${mode}`);
}

async function checkWorkerAvailable(): Promise<boolean> {
  if (workerAvailable !== null) return workerAvailable;

  try {
    const bridge = getParserBridge();
    await bridge.init();
    workerAvailable = bridge.getState() !== 'error';
  } catch {
    workerAvailable = false;
  }

  return workerAvailable;
}

function getLegacyParser(): UniversalParser {
  legacyParser ??= new UniversalParser();
  return legacyParser;
}

function parseMainThread(
  value: string,
  schemaInfo: SchemaInfo,
  formatContext: Partial<FormatContext>,
  normalizationConfig: NormalizationConfig | null,
  languageConfig: LanguageConfig
): unknown {
  return getLegacyParser().parse(
    value,
    schemaInfo,
    formatContext,
    normalizationConfig,
    languageConfig
  );
}

(window as any).workerParser = {
  getParseMode,
  getParserStatus,
  parseBatch,
  parseValue,
  setParseMode
};

// Legacy compatibility (DataProcessor expects uppercase)
(window as any).WorkerParser = (window as any).workerParser;
