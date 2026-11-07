import { describe, expect, it } from 'vitest';

import { md5Hex } from './md5Hex';

// Reference digests computed on 2026-09-30 with the vendor CryptoJS 4.2.0 build
// that this module replaces (public/vendor/crypto-js.min.js, CryptoJS.MD5(s).toString()).
// Stored structureHash_* keys and Dexie files.structureHash depend on these exact values.
const REFERENCE_DIGESTS: readonly (readonly [string, string])[] = [
  ['', 'd41d8cd98f00b204e9800998ecf8427e'],
  ['Name', '49ee3087348e8d44e1feda1917443987'],
  ['Age|Club|Name', '277851f9fd305a81dd3a80c11b1135c4'],
  ['Klub|Wiek|Łódź é', '9012b4910c80a7c62f7d8b8e7fcea255'],
  ['Emoji \u{1F600} NBSP x', '2377f1aa360bb159b4c4d4ff2a61a9bb'],
  ['a'.repeat(1000), 'cabe45dcc9ae5b66ba86600cca6b8ba8']
];

describe('md5Hex', () => {
  it.each(REFERENCE_DIGESTS)('matches the CryptoJS digest for %j', (input, expected) => {
    expect(md5Hex(input)).toBe(expected);
  });
});
