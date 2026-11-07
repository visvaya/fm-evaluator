/**
 * ParserWorker - Web Worker for parsing operations
 * Runs the shared UniversalParser off the main thread, so the worker and the
 * main-thread fallback in workerParser.ts give the same results.
 */
import { expose } from 'comlink';

import { NormalizationConfig as NormalizationConfigClass } from '../parsing/normalizationConfig.js';
import { UniversalParser } from '../parsing/universalParser.js';

import type {
  BatchParseRequest,
  BatchParseResult,
  FormatContext,
  LanguageConfig,
  NormalizationConfig,
  ParseResult,
  SchemaInfo
} from '../parsing/parserTypes';

const parser = new UniversalParser();

/**
 * postMessage drops class methods, so the config arrives as plain data and is
 * rebuilt here. null and undefined both mean "no config": WageParser then
 * leaves wages unnormalised, as on the main thread.
 */
function toNormalizationConfig(
  plain: NormalizationConfig | null | undefined
): NormalizationConfigClass | null {
  return plain ? NormalizationConfigClass.fromSettings(plain) : null;
}

function parseOne(
  value: string,
  schemaInfo: SchemaInfo,
  formatContext: Partial<FormatContext>,
  normalizationConfig: NormalizationConfigClass | null,
  languageConfig: LanguageConfig
): ParseResult {
  try {
    return {
      value: parser.parse(value, schemaInfo, formatContext, normalizationConfig, languageConfig)
    };
  } catch (error) {
    return { error: String(error), value: null };
  }
}

const parserApi = {
  parse(
    value: string,
    schemaInfo: SchemaInfo,
    formatContext: Partial<FormatContext> = {},
    normalizationConfig: NormalizationConfig | null = null,
    languageConfig: LanguageConfig = {}
  ): ParseResult {
    return parseOne(
      value,
      schemaInfo,
      formatContext,
      toNormalizationConfig(normalizationConfig),
      languageConfig
    );
  },

  parseBatch(request: BatchParseRequest): BatchParseResult {
    const start = performance.now();
    const formatContext = request.formatContext ?? {};
    const languageConfig = request.languageConfig ?? {};
    const normalizationConfig = toNormalizationConfig(request.normalizationConfig);
    const results = request.values.map((value) =>
      parseOne(value, request.schemaInfo, formatContext, normalizationConfig, languageConfig)
    );

    return {
      duration: performance.now() - start,
      results
    };
  },

  ping(): string {
    return 'pong';
  }
};

export type ParserApi = typeof parserApi;

expose(parserApi);
