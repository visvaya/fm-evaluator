// @vitest-environment jsdom
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IMPORT_LIMITS } from '@/config/importLimits';

import './goldenLegacyGlobals';
import { processor } from './dataProcessor';

const PUBLIC_DIR = path.join(fileURLToPath(import.meta.url), '..', '..', '..', 'public');
const LIMIT = IMPORT_LIMITS.cellTextLengthChars;

function exportWithClub(club: string): string {
  return `<table>
    <tr><th>UID</th><th>Name</th><th>Club</th></tr>
    <tr><td>1</td><td>Jan Kowalski</td><td>${club}</td></tr>
    <tr><td>2</td><td>Adam Nowak</td><td>Legia</td></tr>
  </table>`;
}

async function importExport(html: string): Promise<unknown> {
  await processor.parseHTML(html, null, false, new File([html], 'long.html'));
  const entry: unknown = processor.fileStack[0];
  return entry;
}

describe('DataProcessor.parseHTML cut cells', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', async (input: string) => {
      const body = await readFile(path.join(PUBLIC_DIR, input), 'utf8');
      return new Response(body, { headers: { 'Content-Type': 'application/json' }, status: 200 });
    });
    processor.fileStack = [];
    processor._initNewSystem();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('records the cells cut to the limit in the file metadata', async () => {
    const entry = await importExport(exportWithClub('x'.repeat(LIMIT + 50)));

    expect(entry).toMatchObject({
      cutCells: [{ column: 'Club', count: 1 }],
      parsedData: [{ Club: 'x'.repeat(LIMIT) }, { Club: 'Legia' }]
    });
  });

  it('records no cut cells for an ordinary export', async () => {
    const entry = await importExport(exportWithClub('Arsenal'));

    expect(entry).toMatchObject({ cutCells: [] });
  });
});
