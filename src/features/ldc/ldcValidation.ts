import * as z from 'zod';

const finiteNumberSchema = z.number();
const starsSchema = finiteNumberSchema
  .min(0.5)
  .max(5)
  .refine((value) => Number.isInteger(value * 2), 'Gwiazdki muszą mieć krok 0,5');

const leagueSchema = z.object({
  id: z.string().trim().min(1).optional(),
  inputScore: finiteNumberSchema.default(0),
  ldcRaw: finiteNumberSchema.default(0),
  multiplier: finiteNumberSchema.default(1),
  name: z.string().trim().min(1),
  nation: z.string().trim().default(''),
  rank: z.int().positive(),
  stars: starsSchema.nullable()
});

const mappingTargetSchema = z.union([
  z.string().trim().min(1),
  z.object({
    name: z.string().trim().min(1),
    nation: z.string().trim().default('')
  })
]);

export const ldcSettingsPayloadSchema = z.object({
  alphaBasket: finiteNumberSchema.min(0.1).max(10).optional(),
  alphaSimple: finiteNumberSchema.min(0.1).max(20).optional(),
  baseLeague: z.string().trim().min(1).optional(),
  baseLeagueNation: z.string().trim().optional(),
  enabled: z.boolean().optional(),
  leagues: z.array(leagueSchema),
  mappings: z.record(z.string(), mappingTargetSchema).optional(),
  model: z.enum(['basket', 'simple']).optional(),
  sortColumn: z
    .enum(['inputScore', 'ldcRaw', 'multiplier', 'name', 'nation', 'rank', 'stars'])
    .optional(),
  sortDirection: z.enum(['asc', 'desc']).optional()
});

/** Saved mapping templates: template name to mappings, in the same shapes as saved mappings. */
export const ldcMappingTemplatesSchema = z.record(
  z.string().trim().min(1),
  z.record(z.string(), mappingTargetSchema)
);

export function parseLdcSettingsPayload(payload: unknown) {
  return ldcSettingsPayloadSchema.safeParse(payload);
}

export function formatLdcValidationError(error: z.ZodError) {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.') || 'plik'}: ${issue.message}`)
    .join('; ');
}
