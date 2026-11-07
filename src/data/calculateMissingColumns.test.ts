import { describe, expect, it } from 'vitest';

import { calculateMissingColumns } from './calculateMissingColumns';

function makeRegistry(
  ids: string[],
  entries: Record<
    string,
    { category: string; legacyName?: string; required: boolean; type: string }
  >
) {
  return {
    getAllIds: () => ids,
    get: (id: string) => entries[id] ?? null,
    getLegacyHeaderName: (id: string) => entries[id]?.legacyName ?? null
  };
}

const REGISTRY = makeRegistry(
  ['basic_name', 'basic_dob', 'basic_age', 'attribute_pace', 'statistic_goals'],
  {
    basic_name: { type: 'text', category: 'basic', required: true, legacyName: 'Name' },
    basic_dob: { type: 'date', category: 'basic', required: false, legacyName: 'DoB' },
    basic_age: { type: 'number', category: 'basic', required: false, legacyName: 'Age' },
    attribute_pace: { type: 'attribute', category: 'player', required: false, legacyName: 'Pac' },
    statistic_goals: { type: 'statistic', category: 'player', required: true, legacyName: 'Gls' }
  }
);

describe('calculateMissingColumns', () => {
  // ── empty columnMap ───────────────────────────────────────────────────────

  it('returns all required and optional for empty columnMap (attr type)', () => {
    const { missingRequired, missingOptional } = calculateMissingColumns('attr', {}, REGISTRY);
    expect(missingRequired).toContain('Name');
    expect(missingOptional).toContain('DoB');
    expect(missingOptional).toContain('Pac');
  });

  // ── fileType: attr ────────────────────────────────────────────────────────

  it('attr type: only checks basic + attribute columns', () => {
    const { missingRequired, missingOptional } = calculateMissingColumns('attr', {}, REGISTRY);
    expect(missingRequired).toContain('Name');
    expect(missingOptional).toContain('Pac');
    expect(missingRequired).not.toContain('Gls');
    expect(missingOptional).not.toContain('Gls');
  });

  it('attr type: does not report already-mapped columns', () => {
    const { missingRequired } = calculateMissingColumns('attr', { 0: 'basic_name' }, REGISTRY);
    expect(missingRequired).not.toContain('Name');
  });

  // ── fileType: stats ───────────────────────────────────────────────────────

  it('stats type: only checks basic + statistic columns', () => {
    const { missingRequired, missingOptional } = calculateMissingColumns('stats', {}, REGISTRY);
    expect(missingRequired).toContain('Name');
    expect(missingRequired).toContain('Gls');
    expect(missingOptional).not.toContain('Pac');
  });

  // ── fileType: both ────────────────────────────────────────────────────────

  it('both type: checks basic + attribute + statistic columns', () => {
    const { missingRequired, missingOptional } = calculateMissingColumns('both', {}, REGISTRY);
    expect(missingRequired).toContain('Name');
    expect(missingRequired).toContain('Gls');
    expect(missingOptional).toContain('Pac');
  });

  // ── fileType: complete ────────────────────────────────────────────────────

  it('complete type: reports all missing regardless of category', () => {
    const { missingRequired, missingOptional } = calculateMissingColumns('complete', {}, REGISTRY);
    expect(missingRequired).toContain('Name');
    expect(missingRequired).toContain('Gls');
    expect(missingOptional).toContain('Pac');
  });

  // ── fileType: unknown / default ───────────────────────────────────────────

  it('unknown type: only checks basic columns', () => {
    const { missingRequired, missingOptional } = calculateMissingColumns('unknown', {}, REGISTRY);
    expect(missingRequired).toContain('Name');
    expect(missingOptional).not.toContain('Pac');
    expect(missingRequired).not.toContain('Gls');
  });

  it('unknown fileType defaults to basic-only behavior', () => {
    const { missingRequired } = calculateMissingColumns('invalid_type', {}, REGISTRY);
    expect(missingRequired).toContain('Name');
    expect(missingRequired).not.toContain('Gls');
  });

  // ── derivable fields ──────────────────────────────────────────────────────

  it('skips basic_age when basic_dob is mapped (derivable)', () => {
    const { missingOptional } = calculateMissingColumns('attr', { 0: 'basic_dob' }, REGISTRY);
    expect(missingOptional).not.toContain('Age');
  });

  it('reports basic_age as missing when basic_dob is not mapped', () => {
    const { missingOptional } = calculateMissingColumns('attr', {}, REGISTRY);
    expect(missingOptional).toContain('Age');
  });

  // ── ignored schema IDs ────────────────────────────────────────────────────

  it('never reports basic_information even if missing', () => {
    const regWithInfo = makeRegistry(['basic_information', 'basic_name'], {
      basic_information: { type: 'text', category: 'basic', required: true, legacyName: 'Info' },
      basic_name: { type: 'text', category: 'basic', required: true, legacyName: 'Name' }
    });
    const { missingRequired } = calculateMissingColumns('attr', {}, regWithInfo);
    expect(missingRequired).not.toContain('Info');
  });

  // ── display names ─────────────────────────────────────────────────────────

  it('uses legacyName as display name when available', () => {
    const { missingRequired } = calculateMissingColumns('attr', {}, REGISTRY);
    expect(missingRequired).toContain('Name');
    expect(missingRequired).not.toContain('basic_name');
  });

  it('falls back to schemaId when no legacyName', () => {
    const regNoLegacy = makeRegistry(['custom_field'], {
      custom_field: { type: 'attribute', category: 'player', required: true }
    });
    const { missingRequired } = calculateMissingColumns('attr', {}, regNoLegacy);
    expect(missingRequired).toContain('custom_field');
  });

  // ── required vs optional ──────────────────────────────────────────────────

  it('separates required and optional correctly', () => {
    const { missingRequired, missingOptional } = calculateMissingColumns('attr', {}, REGISTRY);
    expect(missingRequired).toContain('Name');
    expect(missingOptional).not.toContain('Name');
    expect(missingOptional).toContain('Pac');
    expect(missingRequired).not.toContain('Pac');
  });

  // ── ordering from languageConfig ──────────────────────────────────────────

  it('uses schema ordering from languageConfig.headers when provided', () => {
    const languageConfig = {
      headers: { basic_name: {}, attribute_pace: {} }
    };
    const { missingRequired } = calculateMissingColumns('attr', {}, REGISTRY, [], languageConfig);
    expect(missingRequired).toContain('Name');
  });
});
