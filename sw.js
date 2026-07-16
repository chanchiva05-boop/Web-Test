const CACHE_NAME = 'teva-v18'; // ប្ដូរ version ដើម្បីបង្ខំឲ្យ Update Cache
const urlsToCache = [
  './',
  './index.html',
  './teva.png'
];

// ===== INSTALL =====
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

// ===== ACTIVATE =====
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

// ===== STRATEGIES =====
// Network First - សម្រាប់ HTML និង Navigation
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

// Cache First - សម្រាប់ Static Assets (CSS, JS, Images)
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

// ===== FETCH =====
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // **លែងប្រើ SKYNET.txt និងឯកសារ txt ផ្សេងៗ** – អនុញ្ញាតឲ្យ fetch ធម្មតា
  // ប៉ុន្តែបើចង់ទប់ស្កាត់ការចាប់យកឯកសារ txt ទាំងនោះ យើងអាចទុកចោល ឬបញ្ជូនទៅ network ធម្មតា
  // ឥឡូវយើងឲ្យវាឆ្លងកាត់ដូចឯកសារដទៃ

  // បើជា index.html ឬ Navigation Request → ប្រើ Network First
  if (url.includes('index.html') || url === './' || event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request));
  }
  // បើជា sw.js ខ្លួនឯង → ប្រើ Network First (មិន Cache)
  else if (url.includes('sw.js')) {
    event.respondWith(
      fetch(event.request, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })
    );
  }
  // ឯកសារផ្សេងទៀត → Cache First
  else {
    event.respondWith(cacheFirst(event.request));
  }
});

// ===== MESSAGE HANDLER (សម្រាប់ Clear Cache) =====
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

// ===== CONTROLLER CHANGE =====
self.addEventListener('controllerchange', () => {
  console.log('🔄 Service Worker controller changed');
});
