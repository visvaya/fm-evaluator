/**
 * Types shared by the parser worker, its bridge and the main-thread wrapper.
 */
export interface BatchParseRequest {
  formatContext: Partial<FormatContext>;
  languageConfig?: LanguageConfig;
  normalizationConfig?: NormalizationConfig;
  schemaInfo: SchemaInfo;
  values: string[];
}

export interface BatchParseResult {
  duration: number;
  results: ParseResult[];
}

export interface FormatContext {
  confidence: number;
  currencySymbol: null | string;
  dateFormat: { confidence: number; format: string; separator: string };
  decimalSeparator: string;
  distanceUnits: Set<string>;
  fileId: string;
  thousandSeparator: null | string;
  unknownUnits: { count: number; example: string; unit: string }[];
  wageFrequencies: Set<string>;
}

export interface LanguageConfig {
  multipliers?: Record<string, number>;
  valueTranslations?: Record<string, Record<string, string>>;
}

/**
 * Plain-data shape of `NormalizationConfig` (src/parsing/normalizationConfig.js)
 * as it crosses postMessage: structured cloning drops the class methods.
 */
export interface NormalizationConfig {
  targetDistanceUnit?: 'km' | 'm' | 'mi' | 'yd';
  targetWageFrequency?: 'monthly' | 'weekly' | 'yearly';
  unknownUnitMultipliers?: Record<string, number>;
}

export interface ParseResult {
  error?: string;
  value: unknown;
}

export interface SchemaInfo {
  id: string;
  supportsFrequency?: boolean;
  type:
    | 'attribute'
    | 'currency'
    | 'date'
    | 'enum'
    | 'integer'
    | 'physical'
    | 'statistic'
    | 'string'
    | 'string_pass_through';
}
