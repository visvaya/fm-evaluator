// Builds the service worker precache manifest from the files in dist/ and injects it into
// dist/service-worker.js. Pure functions; the Vite plugin and check-dist do the file I/O.
import { createHash } from 'node:crypto';

const SERVICE_WORKER_FILE = 'service-worker.js';
// Tesseract (about 29 MB) is fetched on demand by the PREFETCH_VENDOR message, not at install.
const ON_DEMAND_PREFIX = 'vendor/tesseract/';
const VERSION_LENGTH = 16;

const MARKERS = {
  coreAssets: '[/* __CORE_ASSETS__ */]',
  vendorAssets: '[/* __VENDOR_ASSETS__ */]',
  version: "'__SW_VERSION__'"
};

const DECLARATIONS = {
  coreAssets: /const CORE_ASSETS = (\[[^\]]*\]);/,
  vendorAssets: /const VENDOR_ASSETS = (\[[^\]]*\]);/,
  version: /const SW_VERSION = ("[^"]*"|'[^']*');/
};

/**
 * @param {{ path: string, content: string | Uint8Array }[]} files paths relative to dist/
 * @returns {{ coreAssets: string[], vendorAssets: string[], version: string }}
 */
export function buildPrecacheManifest(files) {
  const cacheable = files
    .filter((file) => file.path !== SERVICE_WORKER_FILE && !file.path.endsWith('.map'))
    .toSorted((a, b) => (a.path < b.path ? -1 : 1));
  const urls = cacheable.map((file) => `/${file.path}`);
  const hash = cacheable.reduce(
    (acc, file) => acc.update(file.path).update('\0').update(file.content).update('\0'),
    createHash('sha256')
  );
  return {
    coreAssets: ['/', ...urls.filter((url) => !url.startsWith(`/${ON_DEMAND_PREFIX}`))],
    vendorAssets: urls.filter((url) => url.startsWith(`/${ON_DEMAND_PREFIX}`)),
    version: hash.digest('hex').slice(0, VERSION_LENGTH)
  };
}

/** Replaces the placeholder markers in the service worker source with the manifest. */
export function injectPrecacheManifest(source, manifest) {
  return Object.entries(MARKERS).reduce((output, [key, marker]) => {
    if (!output.includes(marker)) {
      throw new Error(`service worker marker ${marker} not found`);
    }
    return output.replace(marker, () => JSON.stringify(manifest[key]));
  }, source);
}

/** Reads the injected manifest back from a built service worker. */
export function readPrecacheManifest(source) {
  if (Object.values(MARKERS).some((marker) => source.includes(marker))) {
    throw new Error('service worker precache manifest was not injected');
  }
  return Object.fromEntries(
    Object.entries(DECLARATIONS).map(([key, pattern]) => {
      const match = pattern.exec(source);
      if (!match) throw new Error(`service worker declaration for ${key} not found`);
      return [key, key === 'version' ? match[1].slice(1, -1) : JSON.parse(match[1])];
    })
  );
}
