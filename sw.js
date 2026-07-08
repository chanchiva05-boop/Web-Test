const CACHE_NAME = 'teva-v13';
const urlsToCache = [
  './',
  './index.html',
  './METFONE.txt',
  './CELLCARD.txt',
  './METFONE1.txt',
  './TOOR.txt',
  './teva.png'
];

// Install Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker installing...', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        console.log('Caching files...');
        // Cache each file individually to avoid failure
        for (const url of urlsToCache) {
          try {
            const response = await fetch(url, { 
              cache: 'no-store',
              headers: { 'Cache-Control': 'no-cache' }
            });
            if (response && response.ok) {
              await cache.put(url, response);
              console.log('✅ Cached:', url);
            } else {
              console.warn('⚠️ Failed to cache:', url, response.status);
            }
          } catch (err) {
            console.warn('⚠️ Error caching:', url, err);
          }
        }
        return self.skipWaiting();
      })
  );
});

// Network First with Better Error Handling
async function networkFirst(request) {
  const originalUrl = request.url.split('?')[0];
  const isTxtFile = originalUrl.includes('METFONE.txt') || 
                     originalUrl.includes('CELLCARD.txt') || 
                     originalUrl.includes('METFONE1.txt') ||
                     originalUrl.includes('TOOR.txt');
  
  try {
    let fetchUrl = request.url;
    if (isTxtFile) {
      const baseUrl = fetchUrl.split('?')[0];
      fetchUrl = baseUrl + '?_=' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    }
    
    console.log('🌐 Fetching from network:', fetchUrl);
    
    const response = await fetch(fetchUrl, { 
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
      await cache.put(originalUrl, responseToCache);
      console.log('🔄 Updated cache:', originalUrl);
      
      // Notify clients
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({ 
          type: 'contentUpdated', 
          file: originalUrl,
          timestamp: Date.now()
        });
      });
      
      return response;
    }
    throw new Error('Network response not OK');
  } catch (error) {
    console.log('📦 Network error, checking cache:', originalUrl);
    
    // Try cache first
    const cachedResponse = await caches.match(originalUrl);
    if (cachedResponse) {
      console.log('✅ Found cached version for:', originalUrl);
      return cachedResponse;
    }
    
    // Return fallback for txt files
    if (isTxtFile) {
      console.log('⚠️ No cache and no network, returning fallback for:', originalUrl);
      if (originalUrl.includes('TOOR.txt')) {
        return new Response('[{"password":"TEVA","fingerprint":""}]', { 
          headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
        });
      }
      // Return empty for other txt files
      return new Response('', { 
        headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
      });
    }
    
    return new Response('Offline', { status: 503 });
  }
}

// HTML Network First
async function htmlNetworkFirst(request) {
  try {
    const response = await fetch(request, { 
      cache: 'no-store',
      headers: { 
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
    if (response && response.status === 200) {
      const responseToCache = response.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, responseToCache);
      console.log('🔄 Updated HTML cache');
      return response;
    }
    throw new Error('Network failed');
  } catch (error) {
    console.log('📦 Using cached HTML');
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    return new Response('Page not available offline', { status: 503 });
  }
}

// Cache First for static assets
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    console.log('✅ Cache hit for:', request.url);
    return cachedResponse;
  }
  try {
    return await fetch(request);
  } catch (error) {
    console.log('⚠️ Failed to fetch:', request.url);
    return new Response('Asset not available', { status: 404 });
  }
}

// Handle fetch events
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // Handle SW.js update
  if (url.includes('sw.js')) {
    event.respondWith(
      fetch(event.request, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })
    );
    return;
  }
  
  // TXT files - network first
  if (url.includes('METFONE.txt') || 
      url.includes('CELLCARD.txt') || 
      url.includes('METFONE1.txt') ||
      url.includes('TOOR.txt')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  // HTML - network first
  if (url.includes('index.html') || url === './' || event.request.mode === 'navigate') {
    event.respondWith(htmlNetworkFirst(event.request));
    return;
  }
  
  // Other assets - cache first
  event.respondWith(cacheFirst(event.request));
});

// Activate and clean old caches
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

// Message handling
self.addEventListener('message', async (event) => {
  console.log('📨 Received message:', event.data);
  const cache = await caches.open(CACHE_NAME);
  
  if (event.data === 'forceUpdate') {
    console.log('📡 Force update triggered - clearing txt caches');
    const txtFiles = ['./METFONE.txt', 'METFONE.txt', './CELLCARD.txt', 'CELLCARD.txt', 
                      './METFONE1.txt', 'METFONE1.txt', './TOOR.txt', 'TOOR.txt'];
    for (const file of txtFiles) {
      try {
        await cache.delete(file);
        console.log('🗑️ Deleted:', file);
      } catch (err) {
        console.warn('⚠️ Could not delete:', file);
      }
    }
    
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'refreshContent', source: 'sw' });
    });
  }
  
  if (event.data === 'clearAllCache') {
    console.log('🧹 Clearing ALL cache...');
    const keys = await cache.keys();
    for (const request of keys) {
      await cache.delete(request);
      console.log('🗑️ Deleted:', request.url);
    }
    
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'cacheCleared', source: 'sw' });
    });
  }
  
  if (event.data === 'checkUpdates') {
    console.log('🔍 Checking for updates...');
    let hasUpdates = false;
    const txtFiles = ['./METFONE.txt', './CELLCARD.txt', './METFONE1.txt', './TOOR.txt'];
    
    for (const file of txtFiles) {
      try {
        const response = await fetch(file + '?_=' + Date.now(), {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (response && response.ok) {
          const cachedResponse = await cache.match(file);
          const newContent = await response.text();
          
          if (cachedResponse) {
            const oldContent = await cachedResponse.text();
            if (oldContent !== newContent) {
              hasUpdates = true;
              console.log('🔄 Content changed for:', file);
            }
          } else {
            hasUpdates = true;
          }
          
          await cache.put(file, response.clone());
          console.log('🔄 Updated:', file);
        }
      } catch (err) {
        console.log('⚠️ Failed to update:', file);
      }
    }
    
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ 
        type: 'updatesChecked', 
        source: 'sw',
        hasUpdates: hasUpdates,
        timestamp: Date.now()
      });
    });
  }
});

// Controller change
self.addEventListener('controllerchange', () => {
  console.log('🔄 Service Worker controller changed');
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'swUpdated', source: 'sw' });
    });
  });
});
