const CACHE_NAME = 'teva-v11';

// Critical files only — install fast, don't block on txt files
const CRITICAL_FILES = [
  './',
  './index.html',
  './teva.png'
];

// txt files cached separately (non-blocking)
const TXT_FILES = [
  './METFONE.txt',
  './CELLCARD.txt',
  './METFONE1.txt'
];

// ── Install: cache critical files only, fast ──────────────────────────────
self.addEventListener('install', event => {
  console.log('SW installing...', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Caching critical files...');
      return cache.addAll(CRITICAL_FILES);
    }).then(() => {
      console.log('Critical files cached. Caching txt files in background...');
      // Cache txt files in background — don't block install
      cacheTxtFilesInBackground();
    })
  );
  self.skipWaiting();
});

// Cache txt files without blocking install
async function cacheTxtFilesInBackground() {
  try {
    const cache = await caches.open(CACHE_NAME);
    for (const file of TXT_FILES) {
      try {
        const response = await fetch(file + '?_=' + Date.now(), {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (response && response.ok) {
          await cache.put(file, response);
          console.log('Cached txt:', file);
        }
      } catch(e) {
        console.log('Skipped txt (offline):', file);
        // Not a problem — fallbacks exist
      }
    }
  } catch(e) {}
}

// ── Network First for txt files ───────────────────────────────────────────
async function networkFirst(request) {
  const originalUrl = request.url.split('?')[0];
  const fetchUrl = originalUrl + '?_=' + Date.now();

  try {
    const response = await fetch(fetchUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(originalUrl, response.clone());
      console.log('Updated cache:', originalUrl);

      // Notify clients
      const clients = await self.clients.matchAll();
      clients.forEach(client => client.postMessage({
        type: 'contentUpdated',
        file: originalUrl,
        timestamp: Date.now()
      }));

      return response;
    }
    throw new Error('Bad status: ' + response?.status);
  } catch(error) {
    console.log('Network failed, using cache:', originalUrl);
    const cached = await caches.match(originalUrl);
    if (cached) return cached;

    // Fallbacks
    if (originalUrl.includes('METFONE1.txt'))
      return new Response('កាកម៉េសហ្អា1', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    if (originalUrl.includes('METFONE.txt'))
      return new Response('កាកម៉េសហ្អា', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    if (originalUrl.includes('CELLCARD.txt'))
      return new Response('TEVA555', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

    return new Response('Offline', { status: 503 });
  }
}

// ── Network First for HTML ────────────────────────────────────────────────
async function htmlNetworkFirst(request) {
  try {
    const response = await fetch(request, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    });
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
      console.log('Updated HTML cache');
      return response;
    }
    throw new Error('HTML fetch failed');
  } catch(error) {
    console.log('Using cached HTML');
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Page not available offline', { status: 503 });
  }
}

// ── Cache First for static assets ────────────────────────────────────────
function cacheFirst(request) {
  return caches.match(request).then(cached => cached || fetch(request));
}

// ── Fetch handler ─────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  if (url.includes('sw.js')) {
    // Always fresh SW
    event.respondWith(fetch(event.request, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }));
    return;
  }

  if (url.includes('METFONE.txt') || url.includes('CELLCARD.txt') || url.includes('METFONE1.txt')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (url.includes('index.html') || url.endsWith('/') || event.request.mode === 'navigate') {
    event.respondWith(htmlNetworkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});

// ── Activate: clear old caches ────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('SW activating...', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
    )).then(() => {
      console.log('Old caches cleared. Claiming clients...');
      return self.clients.claim();
    })
  );
});

// ── Message handler ───────────────────────────────────────────────────────
self.addEventListener('message', async (event) => {
  console.log('SW message:', event.data);

  if (event.data === 'forceUpdate') {
    const cache = await caches.open(CACHE_NAME);
    for (const file of TXT_FILES) {
      await cache.delete(file).catch(() => {});
      await cache.delete('./' + file.replace('./', '')).catch(() => {});
    }
    console.log('Cleared txt files from cache');
    const clients = await self.clients.matchAll();
    clients.forEach(c => c.postMessage({ type: 'refreshContent', source: 'sw' }));
  }

  if (event.data === 'checkUpdates') {
    const cache = await caches.open(CACHE_NAME);
    let hasUpdates = false;
    for (const file of TXT_FILES) {
      try {
        const r = await fetch(file + '?_=' + Date.now(), { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
        if (r && r.ok) {
          const cached = await cache.match(file);
          const newContent = await r.text();
          if (cached) {
            const oldContent = await cached.text();
            if (oldContent !== newContent) hasUpdates = true;
          } else {
            hasUpdates = true;
          }
          await cache.put(file, new Response(newContent, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
        }
      } catch(e) {}
    }
    const clients = await self.clients.matchAll();
    clients.forEach(c => c.postMessage({ type: 'updatesChecked', source: 'sw', hasUpdates, timestamp: Date.now() }));
  }
});

// ── Periodic background sync ──────────────────────────────────────────────
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-content') {
    event.waitUntil(updateContentInBackground());
  }
});

async function updateContentInBackground() {
  console.log('Background sync: updating content');
  const cache = await caches.open(CACHE_NAME);
  let hasUpdates = false;
  for (const file of TXT_FILES) {
    try {
      const r = await fetch(file + '?_=' + Date.now(), { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      if (r && r.ok) {
        const cached = await cache.match(file);
        const newContent = await r.text();
        if (cached) {
          const oldContent = await cached.text();
          if (oldContent !== newContent) hasUpdates = true;
        }
        await cache.put(file, new Response(newContent, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
      }
    } catch(e) {}
  }
  if (hasUpdates) {
    const clients = await self.clients.matchAll();
    clients.forEach(c => c.postMessage({ type: 'backgroundUpdate', source: 'sw', timestamp: Date.now() }));
  }
}

self.addEventListener('controllerchange', () => {
  self.clients.matchAll().then(clients =>
    clients.forEach(c => c.postMessage({ type: 'swUpdated', source: 'sw' }))
  );
});
