// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { computeStructureHash } from './computeStructureHash';
import { md5Hex } from './md5Hex';

function compareByCodeUnit(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

describe('computeStructureHash', () => {
  it('does not depend on window.computeStructureHash being registered', () => {
    // Regression guard: this must work even when the async runtime bootstrap
    // (which used to be the only place setting window.computeStructureHash)
    // has not run yet.
    expect((window as any).computeStructureHash).toBeUndefined();
    expect(() => computeStructureHash(['Name', 'UID'])).not.toThrow();
  });

  it('sorts headers before hashing so column order does not change the hash', () => {
    expect(computeStructureHash(['UID', 'Name'])).toBe(computeStructureHash(['Name', 'UID']));
  });

  it('produces a different hash for a different header set', () => {
    expect(computeStructureHash(['UID', 'Name'])).not.toBe(
      computeStructureHash(['UID', 'Name', 'Club'])
    );
  });

  it('keeps the CryptoJS-era digest of the code-unit sorted, pipe-joined headers', () => {
    // Reference: CryptoJS.MD5('Age|Club|Name') from the removed vendor CryptoJS 4.2.0.
    // Existing structureHash_* entries depend on this exact value.
    expect(computeStructureHash(['Name', 'Club', 'Age'])).toBe('277851f9fd305a81dd3a80c11b1135c4');
  });

  it('sorts by plain code-unit order, not locale, so existing structureHash_* cache entries stay valid', () => {
    // localeCompare would order these differently (e.g. treating diacritics
    // as close to their base letter); plain Array#sort() does not.
    const headers = ['Ł Liga', 'Z Liga', 'A Liga'];
    expect(computeStructureHash(headers)).toBe(
      md5Hex(headers.toSorted(compareByCodeUnit).join('|'))
    );
  });
});
