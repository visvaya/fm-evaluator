// @vitest-environment jsdom
/**
 * Tests for SmartHeaderMapper and ContextResolver
 *
 * SmartHeaderMapper depends on window.ContextResolver + window.SchemaRegistry.
 * ContextResolver depends on window.SchemaRegistry.
 * We mock SchemaRegistry and import the real modules.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Minimal SchemaRegistry mock
// ---------------------------------------------------------------------------

function createMockSchemaRegistry() {
  const schema: Record<string, any> = {
    attribute_acceleration: {
      category: 'physical',
      id: 'attribute_acceleration',
      type: 'attribute'
    },
    attribute_decisions: { category: 'mental', id: 'attribute_decisions', type: 'attribute' },
    attribute_finishing: { category: 'technical', id: 'attribute_finishing', type: 'attribute' },
    attribute_pace: { category: 'physical', id: 'attribute_pace', type: 'attribute' },
    attribute_passing: { category: 'technical', id: 'attribute_passing', type: 'attribute' },
    attribute_stamina: { category: 'physical', id: 'attribute_stamina', type: 'attribute' },
    attribute_strength: { category: 'physical', id: 'attribute_strength', type: 'attribute' },
    attribute_vision: { category: 'mental', id: 'attribute_vision', type: 'attribute' },
    attribute_work_rate: { category: 'mental', id: 'attribute_work_rate', type: 'attribute' },
    basic_club: { category: 'basic', id: 'basic_club', required: false, type: 'string' },
    basic_dob: { category: 'basic', id: 'basic_dob', type: 'date' },
    basic_name: { category: 'basic', id: 'basic_name', required: true, type: 'string' },
    basic_nationality: {
      category: 'basic',
      id: 'basic_nationality',
      required: false,
      type: 'string'
    },
    basic_position: { category: 'basic', id: 'basic_position', required: false, type: 'enum' },
    basic_transfer_value: { category: 'basic', id: 'basic_transfer_value', type: 'currency' },
    basic_uid: { category: 'basic', id: 'basic_uid', required: true, type: 'string' },
    basic_wage: { category: 'basic', id: 'basic_wage', supportsFrequency: true, type: 'currency' },
    statistic_apps: { category: 'statistic', id: 'statistic_apps', type: 'statistic' },
    statistic_assists: { category: 'statistic', id: 'statistic_assists', type: 'statistic' },
    statistic_goals: { category: 'statistic', id: 'statistic_goals', type: 'statistic' },
    statistic_interceptions: {
      category: 'statistic',
      id: 'statistic_interceptions',
      type: 'statistic'
    }
  };

  const categoryIndex: Record<string, string[]> = {};
  for (const [id, info] of Object.entries(schema)) {
    const cat = info.category;
    if (!categoryIndex[cat]) categoryIndex[cat] = [];
    categoryIndex[cat].push(id);
  }

  return {
    get(schemaId: string) {
      return schema[schemaId] || null;
    },
    getAllIds() {
      return Object.keys(schema);
    },
    getByCategory(category: string) {
      return categoryIndex[category] || [];
    },
    has(schemaId: string) {
      return schemaId in schema;
    }
  };
}

// ---------------------------------------------------------------------------
// Load legacy JS modules
// ---------------------------------------------------------------------------

beforeAll(() => {
  // SchemaRegistry mock must be set before ContextResolver is loaded
  (window as any).SchemaRegistry = createMockSchemaRegistry();
});

// ContextResolver and SmartHeaderMapper use `window.SchemaRegistry` in constructor
// so we load them AFTER SchemaRegistry is mocked via dynamic import
let SmartHeaderMapper: any;
let ContextResolver: any;

beforeAll(async () => {
  // @ts-ignore
  await import('../schema/schemaRegistry.js');
  // Override the real one with our mock
  (window as any).SchemaRegistry = createMockSchemaRegistry();

  // @ts-ignore
  await import('./contextResolver.js');
  ContextResolver = (window as any).ContextResolver;

  // @ts-ignore
  await import('./smartHeaderMapper.js');
  SmartHeaderMapper = (window as any).SmartHeaderMapper;
});

// ============================================================================
// SmartHeaderMapper.detectLanguage
// ============================================================================

describe('SmartHeaderMapper.detectLanguage', () => {
  let mapper: any;
  beforeEach(() => {
    mapper = new SmartHeaderMapper();
  });

  it('should detect English headers', () => {
    const headers = ['UID', 'Name', 'Position', 'Club', 'Wage', 'DoB', 'Acc', 'Vis', 'Wor'];
    expect(mapper.detectLanguage(headers)).toBe('en');
  });

  it('should detect Polish headers', () => {
    const headers = ['ID', 'Nazwisko', 'Pozycja', 'Klub', 'Płaca', 'Psp', 'Szb', 'Pra', 'Przg'];
    expect(mapper.detectLanguage(headers)).toBe('pl');
  });

  it('should detect German headers', () => {
    const headers = ['Name', 'UID', 'Verein', 'Gehalt', 'Alter', 'Ace', 'Esf', 'Übs'];
    expect(mapper.detectLanguage(headers)).toBe('de');
  });

  it('should detect French headers', () => {
    const headers = ['Nom', 'UID', 'Club', 'Salaire', 'Âge', 'Acc', 'Vol', 'Vis'];
    expect(mapper.detectLanguage(headers)).toBe('fr');
  });

  it('should detect Spanish headers', () => {
    const headers = ['Nombre', 'UID', 'Club', 'Sueldo', 'Edad', 'Ace', 'Sac', 'Vis'];
    expect(mapper.detectLanguage(headers)).toBe('es');
  });

  it('should detect Japanese headers', () => {
    const headers = ['名前', 'UID', 'クラブ', '給与', '年齢'];
    expect(mapper.detectLanguage(headers)).toBe('ja');
  });

  it('should detect Korean headers', () => {
    const headers = ['이름', 'ID', '클럽', '급여', '나이'];
    expect(mapper.detectLanguage(headers)).toBe('ko');
  });

  it('should default to English for unknown headers', () => {
    const headers = ['Xyzzy', 'Plugh', 'Plover'];
    expect(mapper.detectLanguage(headers)).toBe('en');
  });

  it('should strip zero-width spaces before matching', () => {
    const headers = ['\u200BName', 'UID', 'Club', 'Wage'];
    expect(mapper.detectLanguage(headers)).toBe('en');
  });
});

// ============================================================================
// SmartHeaderMapper.findAnchors
// ============================================================================

describe('SmartHeaderMapper.findAnchors', () => {
  let mapper: any;
  beforeEach(() => {
    mapper = new SmartHeaderMapper();
  });

  it('should find UID and Name in EN headers', () => {
    const headers = ['UID', 'Name', 'Position', 'Club'];
    const anchors = mapper.findAnchors(headers, {});
    expect(anchors.uid).toBe(0);
    expect(anchors.name).toBe(1);
  });

  it('should find ID and Nazwisko in PL headers', () => {
    const headers = ['ID', 'Nazwisko', 'Pozycja', 'Klub'];
    const anchors = mapper.findAnchors(headers, {});
    expect(anchors.uid).toBe(0);
    expect(anchors.name).toBe(1);
  });

  it('should find anchors in Japanese headers', () => {
    const headers = ['編号', '名前', 'クラブ'];
    // 編号 is not in uidVariants (编号 is), so let's use direct match
    const anchors = mapper.findAnchors(headers, {});
    expect(anchors.name).toBe(1);
  });

  it('should return null for missing anchors', () => {
    const headers = ['Position', 'Club', 'Wage'];
    const anchors = mapper.findAnchors(headers, {});
    expect(anchors.uid).toBeNull();
    expect(anchors.name).toBeNull();
  });

  it('should find first occurrence only', () => {
    const headers = ['Name', 'UID', 'Name']; // duplicate Name
    const anchors = mapper.findAnchors(headers, {});
    expect(anchors.name).toBe(0);
    expect(anchors.uid).toBe(1);
  });
});

// ============================================================================
// SmartHeaderMapper._buildHeaderToSchemaMap
// ============================================================================

describe('SmartHeaderMapper._buildHeaderToSchemaMap', () => {
  let mapper: any;
  beforeEach(() => {
    mapper = new SmartHeaderMapper();
  });

  it('should build map from language config headers', () => {
    const langConfig = {
      headers: {
        basic_club: ['Club'],
        basic_name: ['Name'],
        basic_uid: ['UID']
      }
    };
    const { duplicateHeaders, map } = mapper._buildHeaderToSchemaMap(langConfig);
    expect(map.get('Name')).toBe('basic_name');
    expect(map.get('UID')).toBe('basic_uid');
    expect(map.get('Club')).toBe('basic_club');
    expect(duplicateHeaders.size).toBe(0);
  });

  it('should detect duplicate headers across schema IDs', () => {
    const langConfig = {
      headers: {
        attribute_leadership: ['Prz'], // same header for 2 IDs
        statistic_interceptions: ['Prz']
      }
    };
    const { duplicateHeaders, map } = mapper._buildHeaderToSchemaMap(langConfig);
    expect(duplicateHeaders.has('Prz')).toBe(true);
    // Duplicates should NOT be in the exact-match map
    expect(map.has('Prz')).toBe(false);
  });

  it('should handle missing headers config', () => {
    const { duplicateHeaders, map } = mapper._buildHeaderToSchemaMap({});
    expect(map.size).toBe(0);
    expect(duplicateHeaders.size).toBe(0);
  });
});

// ============================================================================
// SmartHeaderMapper.mapHeaders (integration)
// ============================================================================

describe('SmartHeaderMapper.mapHeaders', () => {
  let mapper: any;
  let schemaRegistry: any;

  beforeEach(() => {
    mapper = new SmartHeaderMapper();
    schemaRegistry = createMockSchemaRegistry();
  });

  it('should map known headers via exact match', () => {
    const headers = ['Name', 'UID', 'Club'];
    const langConfig = {
      headers: {
        basic_club: ['Club'],
        basic_name: ['Name'],
        basic_uid: ['UID']
      },
      id: 'en'
    };
    const result = mapper.mapHeaders(headers, langConfig, schemaRegistry);
    expect(result.columnMap[0]).toBe('basic_name');
    expect(result.columnMap[1]).toBe('basic_uid');
    expect(result.columnMap[2]).toBe('basic_club');
    expect(result.unmappedHeaders).toHaveLength(0);
  });

  it('should report unmapped headers', () => {
    const headers = ['Name', 'UID', 'CustomColumn'];
    const langConfig = {
      headers: {
        basic_name: ['Name'],
        basic_uid: ['UID']
      },
      id: 'en'
    };
    const result = mapper.mapHeaders(headers, langConfig, schemaRegistry);
    expect(result.unmappedHeaders).toHaveLength(1);
    expect(result.unmappedHeaders[0].header).toBe('CustomColumn');
    expect(result.unmappedHeaders[0].index).toBe(2);
  });

  it('should handle zero-width spaces in headers', () => {
    const headers = ['\u200BName', '\u200BUID'];
    const langConfig = {
      headers: {
        basic_name: ['Name'],
        basic_uid: ['UID']
      },
      id: 'en'
    };
    const result = mapper.mapHeaders(headers, langConfig, schemaRegistry);
    expect(result.columnMap[0]).toBe('basic_name');
    expect(result.columnMap[1]).toBe('basic_uid');
  });
});

// ============================================================================
// ContextResolver._calculateConfidence
// ============================================================================

describe('ContextResolver._calculateConfidence', () => {
  let resolver: any;
  beforeEach(() => {
    resolver = new ContextResolver();
  });

  it('should return high for bestScore>=4 and diff>=2', () => {
    expect(resolver._calculateConfidence(6, 3, false)).toBe('high');
    expect(resolver._calculateConfidence(4, 2, false)).toBe('high');
  });

  it('should return medium for bestScore>=2 and diff>=1', () => {
    expect(resolver._calculateConfidence(3, 1, false)).toBe('medium');
    expect(resolver._calculateConfidence(2, 1, false)).toBe('medium');
  });

  it('should return low for low scores', () => {
    expect(resolver._calculateConfidence(1, 0, false)).toBe('low');
    expect(resolver._calculateConfidence(0, 0, false)).toBe('low');
  });

  it('should downgrade confidence when alreadyMapped', () => {
    // High score + alreadyMapped → medium
    expect(resolver._calculateConfidence(6, 3, true)).toBe('medium');
    // Medium score + alreadyMapped → low
    expect(resolver._calculateConfidence(3, 1, true)).toBe('low');
  });
});
