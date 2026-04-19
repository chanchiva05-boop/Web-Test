const CACHE_NAME = 'teva-v10';
const urlsToCache = [
  './',
  './index.html',
  './METFONE.txt',
  './CELLCARD.txt',
  './METFONE1.txt',
  './teva.png'
];

// Install Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker installing...', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching files...');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Network First - ALWAYS try network first for txt files
async function networkFirst(request) {
  try {
    let fetchUrl = request.url;
    // បន្ថែម METFONE1.txt ក្នុងការពិនិត្យ
    if (fetchUrl.includes('METFONE.txt') || 
        fetchUrl.includes('CELLCARD.txt') || 
        fetchUrl.includes('METFONE1.txt')) {
      fetchUrl = fetchUrl.split('?')[0] + '?_=' + Date.now();
    }
    
    const response = await fetch(fetchUrl, { 
      cache: 'no-store',
      headers: { 
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    if (response && response.status === 200) {
      const responseToCache = response.clone();
      const cache = await caches.open(CACHE_NAME);
      const originalUrl = request.url.split('?')[0];
      await cache.put(originalUrl, responseToCache);
      console.log('🔄 Updated cache:', originalUrl);
      
      // Notify clients about the update
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
    throw new Error('Network failed');
  } catch (error) {
    console.log('📦 Offline or network error, using cache:', request.url);
    const originalUrl = request.url.split('?')[0];
    const cachedResponse = await caches.match(originalUrl);
    if (cachedResponse) {
      console.log('✅ Found cached version for:', originalUrl);
      return cachedResponse;
    }
    
    // Fallback for txt files
    if (originalUrl.includes('METFONE.txt')) {
      console.log('⚠️ Using fallback for METFONE.txt');
      return new Response('កាកម៉េសហ្អា', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    if (originalUrl.includes('CELLCARD.txt')) {
      console.log('⚠️ Using fallback for CELLCARD.txt');
      return new Response('TEVA555', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    if (originalUrl.includes('METFONE1.txt')) {
      console.log('⚠️ Using fallback for METFONE1.txt');
      return new Response('កាកម៉េសហ្អា1', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    return new Response('Offline', { status: 503 });
  }
}

// Network First for HTML
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

// Handle fetch events
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // ពិនិត្យគ្រប់ឯកសារ txt ទាំង ៣
  if (url.includes('METFONE.txt') || 
      url.includes('CELLCARD.txt') || 
      url.includes('METFONE1.txt')) {
    event.respondWith(networkFirst(event.request));
  }
  else if (url.includes('index.html') || url === './' || event.request.mode === 'navigate') {
    event.respondWith(htmlNetworkFirst(event.request));
  }
  else {
    event.respondWith(cacheFirst(event.request));
  }
});

// Activate and clean old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
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

// Listen for messages from main page
self.addEventListener('message', async (event) => {
  console.log('📨 Received message:', event.data);
  
  if (event.data === 'forceUpdate') {
    console.log('📡 Force update triggered - clearing txt caches');
    const cache = await caches.open(CACHE_NAME);
    
    // លុប txt files ទាំងអស់
    await cache.delete('./METFONE.txt');
    await cache.delete('METFONE.txt');
    await cache.delete('./CELLCARD.txt');
    await cache.delete('CELLCARD.txt');
    await cache.delete('./METFONE1.txt');
    await cache.delete('METFONE1.txt');
    
    console.log('✅ Cleared txt files from cache');
    
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'refreshContent', source: 'sw' });
    });
  }
  
  if (event.data === 'checkUpdates') {
    console.log('🔍 Checking for updates...');
    const cache = await caches.open(CACHE_NAME);
    let hasUpdates = false;
    
    // ពិនិត្យ txt files ទាំង ៣
    const txtFiles = ['./METFONE.txt', './CELLCARD.txt', './METFONE1.txt'];
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

// Periodic background sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-content') {
    event.waitUntil(updateContentInBackground());
  }
});

async function updateContentInBackground() {
  console.log('🔄 Background sync: updating content');
  const cache = await caches.open(CACHE_NAME);
  let hasUpdates = false;
  
  // ធ្វើបច្ចុប្បន្នភាព txt files ទាំង ៣
  const filesToUpdate = ['./METFONE.txt', './CELLCARD.txt', './METFONE1.txt'];
  
  for (const file of filesToUpdate) {
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
            console.log('🔄 Background update - content changed:', file);
          }
        }
        
        await cache.put(file, response.clone());
        console.log('🔄 Background updated:', file);
      }
    } catch (err) {
      console.log('⚠️ Background update failed for:', file);
    }
  }
  
  if (hasUpdates) {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ 
        type: 'backgroundUpdate', 
        source: 'sw',
        timestamp: Date.now()
      });
    });
  }
}

// Auto-update Service Worker
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('sw.js')) {
    event.respondWith(
      fetch(event.request, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })
    );
  }
});

// Handle controller change
self.addEventListener('controllerchange', () => {
  console.log('🔄 Service Worker controller changed');
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'swUpdated', source: 'sw' });
    });
  });
});
