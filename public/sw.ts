/**
 * Service Worker — Offline-first caching for papers & app shell.
 *
 * Strategies:
 *  - App shell (JS/CSS/HTML): Cache-first, update in background
 *  - PDF papers: Cache-first (papers don't change)
 *  - API responses: Network-first, fall back to cache
 *  - Annotation saves: Queue in IndexedDB when offline, sync when online
 */

/// <reference lib="webworker" />
export type {}; // ensure module scope to avoid 'self' redeclaration
const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_VERSION = 'anneruth-v1';
const APP_SHELL_CACHE = `shell-${CACHE_VERSION}`;
const PAPERS_CACHE = `papers-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;

const APP_SHELL_URLS = [
  '/',
  '/past-papers',
];

// ---- Install: precache app shell ----
sw.addEventListener('install', (evt) => {
  const event = evt as ExtendableEvent;
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS))
  );
  sw.skipWaiting();
});

// ---- Activate: clean old caches ----
sw.addEventListener('activate', (evt) => {
  const event = evt as ExtendableEvent;
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== APP_SHELL_CACHE && k !== PAPERS_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  sw.clients.claim();
});

// ---- Fetch: route to correct strategy ----
sw.addEventListener('fetch', (evt) => {
  const event = evt as FetchEvent;
  const url = new URL(event.request.url);

  // PDF papers — cache-first (immutable content)
  if (url.pathname.startsWith('/api/pdf-proxy') || url.pathname.endsWith('.pdf')) {
    event.respondWith(cacheFirst(event.request, PAPERS_CACHE));
    return;
  }

  // API calls — network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request, API_CACHE));
    return;
  }

  // Static assets & app shell — cache-first
  if (
    event.request.destination === 'script' ||
    event.request.destination === 'style' ||
    event.request.destination === 'document' ||
    event.request.destination === 'font' ||
    event.request.destination === 'image'
  ) {
    event.respondWith(cacheFirst(event.request, APP_SHELL_CACHE));
    return;
  }

  // Everything else — network only
  event.respondWith(fetch(event.request));
});

// ---- Strategies ----

async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request: Request, cacheName: string): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// ---- Background Sync (annotation saves) ----

sw.addEventListener('sync', (evt: any) => {
  if (evt.tag === 'sync-annotations') {
    evt.waitUntil(syncAnnotations());
  }
});

async function syncAnnotations(): Promise<void> {
  // Open the offline queue from IndexedDB
  const db = await openSyncDB();
  const tx = db.transaction('syncQueue', 'readonly');
  const store = tx.objectStore('syncQueue');
  const items = await promisifyRequest<any[]>(store.getAll());

  for (const item of items) {
    try {
      await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      // Remove from queue on success
      const deleteTx = db.transaction('syncQueue', 'readwrite');
      deleteTx.objectStore('syncQueue').delete(item.id);
    } catch {
      // Will retry on next sync
      break;
    }
  }
}

function openSyncDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('anneruth-sync', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
