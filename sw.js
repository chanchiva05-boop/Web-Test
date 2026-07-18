const CACHE_NAME = 'teva-v18';
const urlsToCache = [
  './',
  './index.html',
  './teva.png'
];

self.addEventListener('install', event => {
  console.log('Service Worker installing...', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching static assets...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker activating...', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ New Service Worker activated, claiming clients...');
      return self.clients.claim();
    })
  );
});

async function networkFirst(request) {
  try {
    console.log('🌐 Fetching from network:', request.url);
    const response = await fetch(request, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

    if (response && response.status === 200) {
      const responseToCache = response.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, responseToCache);
      return response;
    }
    throw new Error('Network failed');
  } catch (error) {
    console.log('📡 Network error – try cache fallback for:', request.url);
    const cached = await caches.match(request);
    if (cached) {
      console.log('✅ Returning cached version');
      return cached;
    }
    return new Response('Network required', { status: 503 });
  }
}

function cacheFirst(request) {
  return caches.match(request)
    .then(response => {
      if (response) {
        console.log('✅ Cache hit for:', request.url);
        return response;
      }
      return fetch(request);
    });
}

self.addEventListener('fetch', event => {
  const url = event.request.url;

  if (url.includes('index.html') || url === './' || event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request));
  }
  else if (url.includes('sw.js')) {
    event.respondWith(
      fetch(event.request, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })
    );
  }
  else {
    event.respondWith(cacheFirst(event.request));
  }
});

self.addEventListener('message', async (event) => {
  console.log('📨 Received message:', event.data);

  if (event.data === 'clearAllCache') {
    console.log('🧹 Clearing ALL cache...');
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    for (const request of keys) {
      await cache.delete(request);
      console.log('🗑️ Deleted:', request.url);
    }
    console.log('✅ All cache cleared');

    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'cacheCleared', source: 'sw' });
    });
  }
});

self.addEventListener('controllerchange', () => {
  console.log('🔄 Service Worker controller changed');
});
