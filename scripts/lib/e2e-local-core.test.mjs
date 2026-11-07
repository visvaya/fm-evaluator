import { describe, expect, it } from 'vitest';

import { findFreePort, hasCoopHeader, parseE2eArgs } from './e2e-local-core.mjs';

describe('parseE2eArgs', () => {
  it('defaults to dev mode with no playwright args', () => {
    expect(parseE2eArgs([])).toEqual({ preview: false, playwrightArgs: [] });
  });

  it('takes --preview out and passes the rest through', () => {
    expect(parseE2eArgs(['--preview', 'e2e/a11y.spec.ts', '--headed'])).toEqual({
      preview: true,
      playwrightArgs: ['e2e/a11y.spec.ts', '--headed']
    });
  });

  it('drops a leading -- separator and keeps args after it verbatim', () => {
    expect(parseE2eArgs(['--', 'e2e/x.spec.ts', '--preview'])).toEqual({
      preview: false,
      playwrightArgs: ['e2e/x.spec.ts', '--preview']
    });
  });
});

describe('findFreePort', () => {
  it('returns the first port the probe accepts', async () => {
    const busy = new Set([5173, 5174]);
    const port = await findFreePort({ start: 5173, isFree: async (p) => !busy.has(p) });
    expect(port).toBe(5175);
  });

  it('throws when no port in range is free', async () => {
    await expect(
      findFreePort({ start: 6000, attempts: 3, isFree: async () => false })
    ).rejects.toThrow(/6000-6002/);
  });
});

describe('hasCoopHeader', () => {
  it('accepts same-origin COOP case-insensitively', () => {
    expect(hasCoopHeader({ get: () => 'same-origin' })).toBe(true);
  });

  it('rejects a missing header', () => {
    expect(hasCoopHeader({ get: () => null })).toBe(false);
  });
});
