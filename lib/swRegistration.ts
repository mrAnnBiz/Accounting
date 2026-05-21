/**
 * Service Worker registration helper.
 * Call `registerServiceWorker()` once in app startup (e.g. layout.tsx useEffect).
 */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') {
          // New version ready — could notify user
          console.log('[SW] New version activated');
        }
      });
    });

    return registration;
  } catch (err) {
    console.warn('[SW] Registration failed:', err);
    return null;
  }
}

/**
 * Queue an offline request for background sync.
 * Used when a save/upload fails due to no network.
 */
export async function queueOfflineRequest(
  url: string,
  method: string,
  body: string,
  headers: Record<string, string> = { 'Content-Type': 'application/json' }
): Promise<void> {
  const db = await openSyncDB();
  const tx = db.transaction('syncQueue', 'readwrite');
  tx.objectStore('syncQueue').add({ url, method, headers, body, timestamp: Date.now() });

  // Request background sync if available
  const reg = await navigator.serviceWorker.ready;
  if ('sync' in reg) {
    await (reg as any).sync.register('sync-annotations');
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
