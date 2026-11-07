import { describe, expect, it } from 'vitest';

import {
  buildPrecacheManifest,
  injectPrecacheManifest,
  readPrecacheManifest
} from './sw-precache.mjs';

const FILES = [
  { path: 'index.html', content: '<html></html>' },
  { path: 'assets/index-abc123.js', content: 'console.log(1)' },
  { path: 'i18n/messages/index.json', content: '[]' },
  { path: 'vendor/fonts.css', content: 'body{}' },
  { path: 'vendor/tesseract/worker.min.js', content: 'w' },
  { path: 'assets/index-abc123.js.map', content: '{}' },
  { path: 'service-worker.js', content: 'sw' }
];

const SOURCE = [
  "const SW_VERSION = '__SW_VERSION__';",
  'const CORE_ASSETS = [/* __CORE_ASSETS__ */];',
  'const VENDOR_ASSETS = [/* __VENDOR_ASSETS__ */];'
].join('\n');

describe('buildPrecacheManifest', () => {
  it('precaches app files and the root, keeps tesseract for on-demand prefetch', () => {
    const manifest = buildPrecacheManifest(FILES);

    expect(manifest.coreAssets).toEqual([
      '/',
      '/assets/index-abc123.js',
      '/i18n/messages/index.json',
      '/index.html',
      '/vendor/fonts.css'
    ]);
    expect(manifest.vendorAssets).toEqual(['/vendor/tesseract/worker.min.js']);
  });

  it('derives the version from file contents, ignoring the service worker itself', () => {
    const base = buildPrecacheManifest(FILES).version;
    const swChanged = FILES.map((f) =>
      f.path === 'service-worker.js' ? { ...f, content: 'x' } : f
    );
    const appChanged = FILES.map((f) => (f.path === 'index.html' ? { ...f, content: '<p>' } : f));

    expect(base).toMatch(/^[0-9a-f]{16}$/);
    expect(buildPrecacheManifest([...FILES].reverse()).version).toBe(base);
    expect(buildPrecacheManifest(swChanged).version).toBe(base);
    expect(buildPrecacheManifest(appChanged).version).not.toBe(base);
  });
});

describe('injectPrecacheManifest and readPrecacheManifest', () => {
  it('round-trips the manifest through the service worker source', () => {
    const manifest = buildPrecacheManifest(FILES);
    const output = injectPrecacheManifest(SOURCE, manifest);

    expect(output).not.toContain('__');
    expect(readPrecacheManifest(output)).toEqual(manifest);
  });

  it('fails when a marker is missing', () => {
    expect(() => injectPrecacheManifest('const x = 1;', buildPrecacheManifest(FILES))).toThrow(
      /marker .* not found/
    );
  });

  it('fails to read a source that was never injected', () => {
    expect(() => readPrecacheManifest(SOURCE)).toThrow(/not injected/);
  });
});
