/**
 * Zod contracts for language configs, schema registry, and domain data
 * Provides runtime validation for configuration files and parsed data
 */
import * as z from 'zod';

// ============================================================================
// Domain Data Contracts
// ============================================================================

/** File metadata stored in Dexie */
export const FileMetadataSchema = z.object({
  id: z.string().trim().min(1),
  importedAt: z.int().positive(),
  name: z.string().trim().min(1),
  size: z.int().nonnegative().optional(),
  structureHash: z.string().trim().optional()
});

export type FileMetadata = z.infer<typeof FileMetadataSchema>;

/** Audit trail entry */
export const AuditEntrySchema = z.object({
  context: z.unknown().optional(),
  createdAt: z.int().positive(),
  id: z.int().optional(),
  level: z.enum(['info', 'warn', 'error']).default('info'),
  message: z.string().trim().min(1)
});

export type AuditEntry = z.infer<typeof AuditEntrySchema>;

/** Structure hash cache entry with TTL */
export const StructureHashCacheEntrySchema = z.object({
  createdAt: z.int().positive(),
  expiresAt: z.int().positive(),
  hash: z.string().trim().min(1),
  headers: z.array(z.string().trim()),
  hitCount: z.int().nonnegative().default(0)
});

export type StructureHashCacheEntry = z.infer<typeof StructureHashCacheEntrySchema>;

/** Player record - core domain entity */
export const PlayerRecordSchema = z.object({
  age: z.int().positive().optional(),
  // Attributes (dynamic)
  attributes: z.record(z.string(), z.number()).optional(),
  attrScore: z.number().optional(),
  club: z.string().trim().optional(),
  importedAt: z.int().positive().optional(),
  league: z.string().trim().optional(),
  name: z.string().trim().min(1),
  position: z.string().trim().optional(),
  // Metadata
  sourceFile: z.string().trim().optional(),
  // Statistics (dynamic)
  statistics: z.record(z.string(), z.number()).optional(),
  statScore: z.number().optional(),
  // Scores
  totalScore: z.number().optional(),
  uid: z.string().trim().min(1),
  value: z.number().nonnegative().optional(),
  wage: z.number().nonnegative().optional()
});

export type PlayerRecord = z.infer<typeof PlayerRecordSchema>;

/** Import result summary */
export const ImportResultSchema = z.object({
  errors: z.array(z.string().trim()).default([]),
  fileId: z.string().trim(),
  fileName: z.string().trim(),
  importedAt: z.int().positive(),
  recordCount: z.int().nonnegative(),
  structureHash: z.string().trim().optional(),
  success: z.boolean(),
  warnings: z.array(z.string().trim()).default([])
});

export type ImportResult = z.infer<typeof ImportResultSchema>;

// ============================================================================
// Language & Schema Registry Contracts
// ============================================================================

export const SchemaTypeEnum = z.enum([
  'string',
  'string_pass_through',
  'enum',
  'attribute',
  'statistic',
  'currency',
  'date',
  'integer',
  'physical'
]);

export const SchemaCategoryEnum = z.enum([
  'basic',
  'physical',
  'mental',
  'technical',
  'goalkeeper',
  'statistic'
]);

export const SchemaEntrySchema = z.object({
  canBeNegative: z.boolean().optional(),
  category: SchemaCategoryEnum,
  id: z.string().trim(),
  required: z.boolean(),
  supportsFrequency: z.boolean().optional(),
  type: SchemaTypeEnum
});

export type SchemaEntry = z.infer<typeof SchemaEntrySchema>;

export const SchemaRegistrySchema = z.record(z.string(), SchemaEntrySchema);

export type SchemaRegistryType = z.infer<typeof SchemaRegistrySchema>;

export const AnchorNeighborSchema = z.object({
  excludesCategory: z.string().trim().optional(),
  neighbors: z.array(z.string().trim()),
  target: z.string().trim()
});

export const GlobalAnchorsSchema = z.object({
  goalkeeper: z.record(z.string(), AnchorNeighborSchema).optional(),
  mental: z.record(z.string(), AnchorNeighborSchema).optional(),
  physical: z.record(z.string(), AnchorNeighborSchema).optional(),
  statistic: z.record(z.string(), AnchorNeighborSchema).optional(),
  technical: z.record(z.string(), AnchorNeighborSchema).optional()
});

export const ValueTranslationsSchema = z.record(
  z.string(),
  z.record(z.string(), z.string().trim())
);

export const MultipliersSchema = z.record(z.string(), z.number());

export const LanguageConfigSchema = z.object({
  globalAnchors: GlobalAnchorsSchema.optional(),
  headers: z.record(z.string(), z.array(z.string().trim().min(1))),
  id: z.string().trim().min(1),
  multipliers: MultipliersSchema.optional(),
  valueTranslations: ValueTranslationsSchema.optional()
});

export type LanguageConfig = z.infer<typeof LanguageConfigSchema>;

export type ValidationResult<T> =
  | { data: T; success: true }
  | { errors: z.ZodError; success: false };

export function checkLanguageSchemaConsistency(
  languageConfig: LanguageConfig,
  schemaRegistry: SchemaRegistryType
): { missingHeaders: string[]; orphanHeaders: string[] } {
  const schemaIds = new Set(Object.keys(schemaRegistry));
  const headerIds = new Set(Object.keys(languageConfig.headers));

  const orphanHeaders = [...headerIds].filter((id) => !schemaIds.has(id));
  const missingHeaders = [...schemaIds].filter((id) => !headerIds.has(id));

  return { missingHeaders, orphanHeaders };
}

export function formatValidationErrors(errors: z.ZodError): string[] {
  return errors.issues.map((err) => {
    const path = err.path.join('.');
    return `${path}: ${err.message}`;
  });
}

export function validateAuditEntry(data: unknown): ValidationResult<AuditEntry> {
  const result = AuditEntrySchema.safeParse(data);
  if (result.success) {
    return { data: result.data, success: true };
  }
  return { errors: result.error, success: false };
}

export function validateFileMetadata(data: unknown): ValidationResult<FileMetadata> {
  const result = FileMetadataSchema.safeParse(data);
  if (result.success) {
    return { data: result.data, success: true };
  }
  return { errors: result.error, success: false };
}

export function validateImportResult(data: unknown): ValidationResult<ImportResult> {
  const result = ImportResultSchema.safeParse(data);
  if (result.success) {
    return { data: result.data, success: true };
  }
  return { errors: result.error, success: false };
}

// ============================================================================
// Domain Data Validators
// ============================================================================

export function validateLanguageConfig(data: unknown): ValidationResult<LanguageConfig> {
  const result = LanguageConfigSchema.safeParse(data);
  if (result.success) {
    return { data: result.data, success: true };
  }
  return { errors: result.error, success: false };
}

export function validatePlayerRecord(data: unknown): ValidationResult<PlayerRecord> {
  const result = PlayerRecordSchema.safeParse(data);
  if (result.success) {
    return { data: result.data, success: true };
  }
  return { errors: result.error, success: false };
}

/** Validate array of player records, returns valid records and errors */
export function validatePlayerRecords(data: unknown[]): {
  invalid: { errors: string[]; index: number }[];
  valid: PlayerRecord[];
} {
  const valid: PlayerRecord[] = [];
  const invalid: { errors: string[]; index: number }[] = [];

  data.forEach((item, index) => {
    const result = PlayerRecordSchema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push({ errors: formatValidationErrors(result.error), index });
    }
  });

  return { invalid, valid };
}

export function validateSchemaEntry(data: unknown): ValidationResult<SchemaEntry> {
  const result = SchemaEntrySchema.safeParse(data);
  if (result.success) {
    return { data: result.data, success: true };
  }
  return { errors: result.error, success: false };
}

export function validateSchemaRegistry(data: unknown): ValidationResult<SchemaRegistryType> {
  const result = SchemaRegistrySchema.safeParse(data);
  if (result.success) {
    return { data: result.data, success: true };
  }
  return { errors: result.error, success: false };
}
