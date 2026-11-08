const SW_VERSION = '__SW_VERSION__';
const CACHE_PREFIX = 'fm-evaluator-static';
const STATIC_CACHE_NAME = `${CACHE_PREFIX}-${SW_VERSION}`;
const BACKUP_CACHE_NAME = `${CACHE_PREFIX}-rollback`;
const METADATA_ENDPOINT = '/__sw_metadata__';
// Servers may answer with `Vary: Origin` (vite preview does). Precached entries are stored
// without an Origin header, while crossorigin scripts and styles send one, so a Vary-aware
// lookup misses them offline. Static assets do not differ by origin, so ignore Vary.
const MATCH_OPTIONS = { ignoreVary: true };

// Filled in at build time by the fm-sw-precache Vite plugin (scripts/lib/sw-precache.mjs):
// CORE_ASSETS is every file in dist/ except the on-demand tesseract files in VENDOR_ASSETS,
// and SW_VERSION is a hash of their contents, so each build with changes refreshes clients.
const CORE_ASSETS = [/* __CORE_ASSETS__ */];
const VENDOR_ASSETS = [/* __VENDOR_ASSETS__ */];

let latestProfileReport = null;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE_NAME);
      await cache.addAll(CORE_ASSETS);
      await writeMetadata(cache);
    })()
  );
  // No skipWaiting here: an update waits until every tab is closed or the user applies it
  // (SKIP_WAITING message), so open pages keep the old worker and its cached chunks.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const obsolete = keys.filter(
        (key) =>
          key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE_NAME && key !== BACKUP_CACHE_NAME
      );
      const newestPrevious = obsolete.sort().pop();
      if (newestPrevious) {
        await snapshotBackup(newestPrevious);
      }
      await Promise.all(obsolete.map((key) => caches.delete(key)));
    })()
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  // Only pages of this origin can control the worker; ignore anything else.
  if (event.origin !== self.location.origin) return;
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  switch (data.type) {
    case 'PREFETCH_VENDOR': {
      event.waitUntil(prefetchVendorAssets());
      break;
    }
    case 'PROFILE_REPORT': {
      latestProfileReport = data.report || null;
      break;
    }
    case 'REQUEST_SW_HEALTH': {
      event.waitUntil(respondWithHealth(event.source));
      break;
    }
    case 'REQUEST_SW_ROLLBACK': {
      event.waitUntil(performRollback(event.source));
      break;
    }
    case 'SKIP_WAITING': {
      self.skipWaiting();
      break;
    }
    default: {
      break;
    }
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (requestUrl.pathname === METADATA_ENDPOINT) {
    event.respondWith(caches.match(METADATA_ENDPOINT));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request, MATCH_OPTIONS);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    const cache = await caches.open(STATIC_CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    return cached || Response.error();
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(STATIC_CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request, MATCH_OPTIONS);
    if (cached) return cached;
    return caches.match('/index.html', MATCH_OPTIONS);
  }
}

async function performRollback(source) {
  const hasBackup = (await caches.keys()).includes(BACKUP_CACHE_NAME);
  if (!hasBackup) {
    await respond(source, {
      message: 'Brak kopii zapasowej cache.',
      ok: false,
      type: 'SW_ROLLBACK_RESULT'
    });
    return;
  }

  const backup = await caches.open(BACKUP_CACHE_NAME);
  const target = await caches.open(STATIC_CACHE_NAME);
  const currentEntries = await target.keys();
  await Promise.all(currentEntries.map((request) => target.delete(request)));

  const requests = await backup.keys();
  await Promise.all(
    requests.map(async (request) => {
      const response = await backup.match(request);
      if (response) {
        await target.put(request, response);
      }
    })
  );

  await respond(source, {
    cache: STATIC_CACHE_NAME,
    ok: true,
    type: 'SW_ROLLBACK_RESULT'
  });
}

async function prefetchVendorAssets() {
  const cache = await caches.open(STATIC_CACHE_NAME);
  await Promise.allSettled(
    VENDOR_ASSETS.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'no-cache' });
        if (response.ok) {
          await cache.put(url, response.clone());
        }
      } catch {
        // Skip missing assets; which ones exist depends on the runtime profile
      }
    })
  );
}

async function respond(source, message) {
  if (source && 'postMessage' in source) {
    source.postMessage(message);
    return;
  }
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach((client) => client.postMessage(message));
}

async function respondWithHealth(source) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const entries = await cache.keys();
  const backupAvailable = (await caches.keys()).includes(BACKUP_CACHE_NAME);

  await respond(source, {
    payload: {
      backupAvailable,
      cachedEntries: entries.length,
      cacheName: STATIC_CACHE_NAME,
      profile: latestProfileReport,
      swVersion: SW_VERSION
    },
    type: 'SW_HEALTH_RESPONSE'
  });
}

async function snapshotBackup(previousCacheName) {
  if (!previousCacheName) return;
  const source = await caches.open(previousCacheName);
  const dest = await caches.open(BACKUP_CACHE_NAME);
  const existing = await dest.keys();
  await Promise.all(existing.map((request) => dest.delete(request)));
  const keys = await source.keys();
  await Promise.all(
    keys.map(async (request) => {
      const response = await source.match(request);
      if (response) {
        await dest.put(request, response);
      }
    })
  );
}

async function writeMetadata(cache) {
  const metadata = {
    cacheName: STATIC_CACHE_NAME,
    generatedAt: Date.now(),
    version: SW_VERSION
  };
  await cache.put(
    METADATA_ENDPOINT,
    Response.json(metadata, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json'
      }
    })
  );
}
