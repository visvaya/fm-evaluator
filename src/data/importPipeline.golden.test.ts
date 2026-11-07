// @vitest-environment jsdom
/**
 * Golden master for the import pipeline: FM export HTML -> parseHTML (legacy
 * window.* parsers and mappers) -> mergeData -> runAnalysis (scoring) ->
 * filtered and sorted table rows.
 *
 * Any extraction from the legacy layer must leave these files byte-identical.
 * A diff is a behaviour change: fix the code, or, when the change is intended,
 * regenerate with `pnpm test:goldens:update` and explain the diff in the same
 * commit. Never regenerate just to make a red test green. Procedure:
 * docs/workflows/extract-module.md.
 *
 * Every case runs on two parse paths: the synchronous UniversalParser fallback
 * and the parser worker (src/workers/parser.worker.ts behind the real
 * src/parsing/workerParser.ts, in-process; see installWorkerParser). The two
 * paths carry separate copies of the value parsers, so each has its own
 * snapshots.
 *
 * Not covered here: the header-mapping and format-verification modals (they
 * are only shown when window.HeaderMappingModal / FormatVerificationModal are
 * registered, which this harness does not do), the Web Worker and Comlink
 * transport themselves (timeouts, circuit breaker) and OCR.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BatchParseRequest } from '@/parsing/parserTypes';
import type { ParserApi } from '@/workers/parser.worker';

// Plain paths: under jsdom the global URL is jsdom's, which node:fs rejects.
const APP_DIR = path.join(fileURLToPath(import.meta.url), '..', '..', '..');
const FIXTURES_DIR = path.join(APP_DIR, 'goldens', 'fixtures');
const E2E_FIXTURES_DIR = path.join(APP_DIR, 'e2e', 'fixtures');
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const SNAPSHOT_DIR = '../../goldens/snapshots/';
const FIXED_NOW_MS = Date.UTC(2026, 0, 1);
const ROLES = ['GK', 'DLR', 'DC', 'WBLR', 'DMC', 'MC', 'MLR', 'AMC', 'AMLR', 'STC'] as const;
const ENGINES = ['Default', 'AsianFusion', 'FMTweak'] as const;

type ParsePath = 'fallback' | 'worker';

interface GoldenCase {
  // Keep per-stat details (filters, statDetails, attrDetails) for the Default
  // engine. They dominate the file size, so only a few cases carry them.
  details: boolean;
  engines: readonly string[];
  files: readonly { name: string; path: string }[];
  id: string;
  parsePath: ParsePath;
}

const fixture = (name: string, dir = FIXTURES_DIR) => ({ name, path: path.join(dir, name) });

// Every path comes from the constants above, never from test input.
// eslint-disable-next-line security/detect-non-literal-fs-filename
const readText = (filePath: string): Promise<string> => readFile(filePath, 'utf8');

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

const FIXTURE_CASES: Omit<GoldenCase, 'parsePath'>[] = [
  {
    id: 'fm-export-en-uk',
    details: true,
    engines: ENGINES,
    files: [fixture('fm-export-en-uk.html')]
  },
  {
    id: 'fm-export-en-us',
    details: false,
    engines: ['Default'],
    files: [fixture('fm-export-en-us.html')]
  },
  {
    id: 'fm-export-pl',
    details: false,
    engines: ['Default'],
    files: [fixture('fm-export-pl.html')]
  },
  {
    id: 'sample-en-attributes-and-stats',
    details: true,
    engines: ['Default'],
    files: [
      fixture('sample-attributes-en.html', E2E_FIXTURES_DIR),
      fixture('sample-stats-en.html', E2E_FIXTURES_DIR)
    ]
  },
  {
    id: 'sample-pl-attributes-and-stats',
    details: true,
    engines: ['Default'],
    files: [
      fixture('sample-attributes-pl.html', E2E_FIXTURES_DIR),
      fixture('sample-stats-pl.html', E2E_FIXTURES_DIR)
    ]
  }
];

// The worker path pins import and merged records for every fixture, but
// scoring only for the Default engine without per-stat details: the engines
// share the parsed input, and the full analyses would double the goldens.
const CASES: GoldenCase[] = [
  ...FIXTURE_CASES.map((goldenCase) => ({ ...goldenCase, parsePath: 'fallback' as const })),
  ...FIXTURE_CASES.map((goldenCase) => ({
    ...goldenCase,
    details: false,
    engines: ['Default'],
    parsePath: 'worker' as const
  }))
];

// Fallback snapshots keep their original names; worker snapshots add a suffix.
const snapshotName = ({ id, parsePath }: GoldenCase, kind: string): string =>
  `${SNAPSHOT_DIR}${id}${parsePath === 'worker' ? '.worker' : ''}.${kind}.json`;

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

// Local calendar fields, not toISOString(): parsers build dates with
// new Date(year, month, day), so UTC output would depend on the machine's zone.
function formatDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return '<Invalid Date>';
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `<Date ${day}T${time}.${pad(date.getMilliseconds(), 3)}>`;
}

// JSON drops NaN, Infinity and undefined silently; spell them out so a change
// between them and null still shows up as a diff. A Date has no own keys, so
// the object branch below would write it as {}. Keys are sorted so the file
// only changes when values change.
function normalize(input: unknown): unknown {
  if (input instanceof Date) return formatDate(input);
  if (typeof input === 'number' && !Number.isFinite(input)) return `<${String(input)}>`;
  if (input === undefined) return '<undefined>';
  if (typeof input === 'function') return '<function>';
  if (input instanceof Map) return { '<Map>': normalize([...input.entries()]) };
  if (input instanceof Set) return { '<Set>': normalize([...input.values()]) };
  if (Array.isArray(input)) return input.map((item) => normalize(item));
  if (input && typeof input === 'object') {
    return Object.fromEntries(
      Object.keys(input)
        .toSorted(compareCodeUnits)
        .map((key) => [key, normalize((input as Record<string, unknown>)[key])])
    );
  }
  return input;
}

const toStableJson = (value: unknown): string => `${JSON.stringify(normalize(value), null, 1)}\n`;
const fingerprint = (value: unknown): string => JSON.stringify(normalize(value));
// One compact JSON value per line: a diff then points at one player and role.
const toJsonLines = (rows: readonly unknown[]): string =>
  `[\n${rows.map((row) => fingerprint(row)).join(',\n')}\n]\n`;
const DETAIL_FIELDS = new Set(['attrDetails', 'filters', 'statDetails']);
const uidOf = (row: Record<string, unknown>): string => {
  const uid = row.UID ?? row.basic_uid;
  return typeof uid === 'string' || typeof uid === 'number' ? String(uid) : '';
};

type Fingerprints = Map<string, Record<string, string>>;

const fingerprintRows = (rows: Record<string, unknown>[]): Fingerprints =>
  new Map(
    rows.map((row) => [
      uidOf(row),
      Object.fromEntries(Object.entries(row).map(([key, value]) => [key, fingerprint(value)]))
    ])
  );

// Score rows spread the whole player record. Keep only the fields scoring
// added or changed, so the golden stays reviewable.
function scoringFields(row: Record<string, unknown>, before: Fingerprints, details: boolean) {
  const original = before.get(uidOf(row)) ?? {};
  return Object.fromEntries(
    Object.entries(row).filter(
      ([key, value]) => original[key] !== fingerprint(value) && (details || !DETAIL_FIELDS.has(key))
    )
  );
}

function stubLanguageConfigFetch(): void {
  vi.stubGlobal('fetch', async (input: string) => {
    const body = await readText(path.join(PUBLIC_DIR, input));
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
}

interface WorkerCalls {
  batches: number;
  failures: string[];
}

// Runs parser.worker.ts in this thread behind the real workerParser.ts, which
// registers window.WorkerParser as in the browser. Requests and results pass
// through structuredClone like postMessage: class instances arrive as plain
// objects without methods, and an uncloneable value throws, which sends
// workerParser.ts to its main-thread fallback exactly as in production.
async function installWorkerParser(): Promise<WorkerCalls> {
  const calls: WorkerCalls = { batches: 0, failures: [] };
  let workerApi: ParserApi | undefined;
  vi.doMock('comlink', () => ({
    expose: (api: ParserApi) => {
      workerApi = api;
    }
  }));
  await import('@/workers/parser.worker');
  if (!workerApi) throw new Error('parser.worker.ts did not expose its API');
  const api = workerApi;

  vi.doMock('@/workerBridge', () => ({
    getParserBridge: () => ({
      getState: () => 'idle',
      init: () => Promise.resolve(),
      // The pipeline only batches; a single-value call would bypass the counts.
      parse: () => {
        calls.failures.push('unexpected single-value parse call');
        return Promise.reject(new Error('parse() is not wired in the golden harness'));
      },
      parseBatch: (request: BatchParseRequest) => {
        try {
          const result = structuredClone(api.parseBatch(structuredClone(request)));
          calls.batches += 1;
          // workerParser.ts keeps only `value`, so per-value errors would vanish.
          for (const { error } of result.results) {
            if (error !== undefined) calls.failures.push(error);
          }
          return Promise.resolve(result);
        } catch (error) {
          calls.failures.push(String(error));
          return Promise.reject(error instanceof Error ? error : new Error(String(error)));
        }
      }
    })
  }));
  await import('@/parsing/workerParser');
  return calls;
}

// Fresh module graph per case: the processor singleton, Zustand stores and
// legacy window registrations must not leak between cases.
async function loadPipeline(parsePath: ParsePath) {
  vi.resetModules();
  const workerCalls = parsePath === 'worker' ? await installWorkerParser() : null;
  await import('./goldenLegacyGlobals');

  const { processor } = await import('@/data/dataProcessor');
  const { parseImportedHtml } = await import('@/data/importRuntime');
  const { runAnalysis } = await import('@/lib/analysisService');
  const { getFilteredData, getSortedData } = await import('@/ui/filterData');
  const { markFiltersDirty } = await import('@/store/tableStore');
  processor._initNewSystem();
  return {
    getFilteredData,
    getSortedData,
    markFiltersDirty,
    parseImportedHtml,
    processor,
    runAnalysis,
    workerCalls
  };
}

async function runCase(goldenCase: GoldenCase) {
  const pipeline = await loadPipeline(goldenCase.parsePath);
  const { processor } = pipeline;

  const imports = [];
  for (const [index, fixtureFile] of goldenCase.files.entries()) {
    const { name } = fixtureFile;
    const html = await readText(fixtureFile.path);
    const file = new File([html], name, { type: 'text/html' });
    const result = await pipeline.parseImportedHtml({
      file,
      fileNumber: index + 1,
      html,
      onStatus: () => undefined,
      parseHTML: processor.parseHTML.bind(processor),
      shouldAppend: index > 0,
      totalFiles: goldenCase.files.length
    });
    const [stackEntry] = processor.fileStack;
    imports.push({
      columnMap: stackEntry.columnMap,
      detectedLanguage: stackEntry.detectedLanguage,
      file: name,
      formatContext: stackEntry.formatContext,
      parsedData: stackEntry.parsedData,
      result
    });
  }

  processor.mergeData(false);
  // Scoring mutates player records (derived stats), so freeze them first.
  const merged = toStableJson(processor.mergedData);
  const before = fingerprintRows(processor.mergedData);

  const analyses = [];
  for (const engine of goldenCase.engines) {
    const details = goldenCase.details && engine === 'Default';
    for (const role of ROLES) {
      const scores = pipeline.runAnalysis(engine, role);
      pipeline.markFiltersDirty();
      const table = pipeline.getSortedData(pipeline.getFilteredData());
      analyses.push(
        { engine, role, table: table.map((row) => uidOf(row)) },
        ...scores.map((row) => ({ engine, role, ...scoringFields(row, before, details) }))
      );
    }
  }

  return { analyses, imports, merged, workerCalls: pipeline.workerCalls };
}

describe('import pipeline goldens', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW_MS);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    localStorage.clear();
    sessionStorage.clear();
    stubLanguageConfigFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.doUnmock('comlink');
    vi.doUnmock('@/workerBridge');
    // vi.resetModules() does not reset jsdom's window: without this, a worker
    // case would leave window.WorkerParser for the fallback cases after it.
    delete (window as any).WorkerParser;
    delete (window as any).workerParser;
  });

  it.each(CASES)(
    '$id ($parsePath)',
    async (goldenCase) => {
      const { analyses, imports, merged, workerCalls } = await runCase(goldenCase);

      expect(imports).toHaveLength(goldenCase.files.length);
      expect(analyses.length).toBeGreaterThan(goldenCase.engines.length * ROLES.length);
      // A silent fallback to UniversalParser would pin the wrong path.
      const onWorkerPath = goldenCase.parsePath === 'worker';
      expect(workerCalls?.failures ?? []).toEqual([]);
      expect((workerCalls?.batches ?? 0) > 0).toBe(onWorkerPath);
      expect((window as any).WorkerParser !== undefined).toBe(onWorkerPath);
      await expect(toStableJson(imports)).toMatchFileSnapshot(snapshotName(goldenCase, 'import'));
      await expect(merged).toMatchFileSnapshot(snapshotName(goldenCase, 'merged'));
      await expect(toJsonLines(analyses)).toMatchFileSnapshot(snapshotName(goldenCase, 'analysis'));
    },
    120_000
  );
});
